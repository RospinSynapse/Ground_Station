#include <Arduino.h>
#include <SPI.h>
#include <LoRa.h>
#include <WiFi.h>
#include <WebSocketsServer.h>
#include <ArduinoJson.h>
#include "RadioFrames.h"
#include "config.h"

WebSocketsServer websocket(81);
SynapseRadio::Assembler assembler;
String outgoing;
String uartLine;
uint32_t sessionId, messageId = 0, receivedPackets = 0, nextFrameAt = 0, lastStatus = 0, txStarted = 0;
uint8_t frameIndex = 0;
volatile bool txDone = false;
bool transmitting = false, radioReady = false, discardLine = false, gatewayStarted = false;
bool authenticated[WEBSOCKETS_SERVER_CLIENT_MAX] = {};
int lastRssi = 0;
bool hasRssi = false;

void onTxDone() { txDone = true; }
void sendError(uint8_t client, const char* message) {
  JsonDocument value;
  value["type"] = "gateway_error"; value["message"] = message;
  String output; serializeJson(value, output); websocket.sendTXT(client, output);
}
void reportRadioError(const char* message) {
  Serial.println(message);
#if SYNAPSE_GROUND
  for (uint8_t client = 0; client < WEBSOCKETS_SERVER_CLIENT_MAX; client++) if (authenticated[client]) sendError(client, message);
#else
  JsonDocument value;
  value["type"] = "bridge_status"; value["state"] = "error"; value["message"] = message;
  serializeJson(value, Serial2); Serial2.println();
#endif
}
void sendStatus(uint8_t client) {
  JsonDocument value;
  value["type"] = "gateway_status"; value["authenticated"] = true;
  value["radioReady"] = radioReady; value["receivedPackets"] = receivedPackets;
  if (hasRssi) value["lastRssi"] = lastRssi; else value["lastRssi"] = nullptr;
  String output; serializeJson(value, output); websocket.sendTXT(client, output);
}
bool queueMessage(const String& value) {
  if (!radioReady || outgoing.length() || !value.length() || value.length() > SynapseRadio::MaxMessage) return false;
  outgoing = value; frameIndex = 0; messageId++; nextFrameAt = millis(); return true;
}
void onWebSocket(uint8_t client, WStype_t type, uint8_t* payload, size_t length) {
  if (client >= WEBSOCKETS_SERVER_CLIENT_MAX) return;
  if (type == WStype_CONNECTED || type == WStype_DISCONNECTED) { authenticated[client] = false; return; }
  if (type != WStype_TEXT) return;
  if (length > SynapseRadio::MaxMessage + 128) { sendError(client, "Message too large"); return; }
  JsonDocument value;
  if (deserializeJson(value, payload, length)) { sendError(client, "Invalid JSON"); return; }
  const String kind = value["type"] | "";
  if (kind == "gateway_auth") {
    const String token = value["token"] | "";
    if (token != GATEWAY_ACCESS_TOKEN) { sendError(client, "Invalid gateway token"); websocket.disconnect(client); return; }
    authenticated[client] = true; sendStatus(client); return;
  }
  if (!authenticated[client]) { sendError(client, "Authenticate first"); return; }
  if (kind != "gateway_tx") { sendError(client, "Unknown gateway request"); return; }
  JsonObject packet = value["packet"].as<JsonObject>();
  const String command = packet["type"] | "";
  if ((command != "set_mode" && command != "request_data") || packet["version"].as<int>() != 1 || !packet["commandId"].is<const char*>() || !packet["missionId"].is<const char*>()) {
    sendError(client, "Invalid command"); return;
  }
  String output; serializeJson(packet, output);
  if (!queueMessage(output)) sendError(client, "Radio unavailable or busy; command not queued");
}
void processLine(const String& line) {
  JsonDocument value;
  if (deserializeJson(value, line)) { Serial.println("Invalid OBC JSON"); return; }
  if (value["version"].as<int>() != 1 || !value["packetId"].is<const char*>() || !value["timestamp"].is<const char*>() || String(value["missionId"] | "") != FLIGHT_MISSION_ID) {
    Serial.println("Invalid OBC packet envelope"); return;
  }
  const String type = value["type"] | "";
  if (type != "telemetry" && type != "classification" && type != "classification_point" && type != "system_log" && type != "state" && type != "command_ack") {
    Serial.println("Unsupported OBC packet type"); return;
  }
  if (!queueMessage(line)) Serial2.println("{\"type\":\"bridge_status\",\"state\":\"busy\"}");
  else Serial2.println("{\"type\":\"bridge_status\",\"state\":\"queued\"}");
}
void receiveRadio() {
  const int size = LoRa.parsePacket();
  if (!size) return;
  uint8_t frame[255]; size_t count = 0;
  while (LoRa.available() && count < sizeof(frame)) frame[count++] = uint8_t(LoRa.read());
  if (!assembler.accept(frame, count, SYNAPSE_GROUND ? 0 : 1, millis())) return;
  JsonDocument value;
  if (deserializeJson(value, assembler.data(), assembler.size())) return;
  receivedPackets++; lastRssi = LoRa.packetRssi(); hasRssi = true;
#if SYNAPSE_GROUND
  String output(assembler.data());
  Serial.println(output);
  for (uint8_t client = 0; client < WEBSOCKETS_SERVER_CLIENT_MAX; client++) if (authenticated[client]) websocket.sendTXT(client, output);
#else
  const String type = value["type"] | "";
  if (value["version"].as<int>() == 1 && (type == "set_mode" || type == "request_data") && String(value["missionId"] | "") == FLIGHT_MISSION_ID && value["commandId"].is<const char*>()) Serial2.println(assembler.data());
#endif
}
void serviceRadio() {
  if (transmitting) {
    if (!txDone && uint32_t(millis() - txStarted) <= 30000) return;
    if (!txDone) {
      transmitting = false; outgoing = ""; LoRa.idle(); LoRa.receive();
      reportRadioError("Radio transmit timeout");
      return;
    }
    transmitting = false; txDone = false; frameIndex++;
    if (size_t(frameIndex) * SynapseRadio::Chunk >= outgoing.length()) {
      outgoing = "";
#if !SYNAPSE_GROUND
      Serial2.println("{\"type\":\"bridge_status\",\"state\":\"sent\"}");
#endif
    }
    nextFrameAt = millis() + RADIO_FRAME_GAP_MS;
    LoRa.receive();
  }
  if (outgoing.length() && int32_t(millis() - nextFrameAt) >= 0) {
    uint8_t frame[SynapseRadio::Header + SynapseRadio::Chunk];
    const size_t size = SynapseRadio::encode(reinterpret_cast<const uint8_t*>(outgoing.c_str()), outgoing.length(), sessionId, messageId, SYNAPSE_GROUND ? 1 : 0, frameIndex, frame);
    LoRa.idle();
    if (!size || !LoRa.beginPacket()) { outgoing = ""; reportRadioError("Radio transmit failed"); LoRa.receive(); return; }
    LoRa.write(frame, size); txDone = false; transmitting = true; txStarted = millis();
    if (!LoRa.endPacket(true)) { transmitting = false; outgoing = ""; reportRadioError("Radio transmit failed"); }
    return;
  }
  receiveRadio();
}
void setup() {
  Serial.begin(115200);
  if (RADIO_SPREADING_FACTOR < 7 || RADIO_SPREADING_FACTOR > 12 || (RADIO_BANDWIDTH_HZ != 125000 && RADIO_BANDWIDTH_HZ != 250000 && RADIO_BANDWIDTH_HZ != 500000)) { Serial.println("Unsupported radio modulation configuration"); return; }
  if (!RADIO_CONFIGURED) { Serial.println("Set RADIO_CONFIGURED after checking board pins and radio parameters"); return; }
#if SYNAPSE_GROUND
  if (strlen(GATEWAY_AP_PASSWORD) < 8 || strlen(GATEWAY_ACCESS_TOKEN) < 16) { Serial.println("Configure AP password and gateway access token"); return; }
  WiFi.mode(WIFI_AP);
  if (!WiFi.softAP(GATEWAY_AP_NAME, GATEWAY_AP_PASSWORD)) { Serial.println("Wi-Fi AP failed"); return; }
  websocket.begin(); websocket.onEvent(onWebSocket); gatewayStarted = true;
  Serial.print("Ground receiver IP: "); Serial.println(WiFi.softAPIP());
#else
  Serial2.begin(OBC_UART_BAUD, SERIAL_8N1, OBC_UART_RX, OBC_UART_TX);
#endif
  SPI.begin(RADIO_SCK, RADIO_MISO, RADIO_MOSI, RADIO_CS);
  LoRa.setPins(RADIO_CS, RADIO_RESET, RADIO_DIO0);
  if (!LoRa.begin(RADIO_FREQUENCY_HZ)) { Serial.println("LoRa initialization failed"); return; }
  LoRa.setSpreadingFactor(RADIO_SPREADING_FACTOR); LoRa.setSignalBandwidth(RADIO_BANDWIDTH_HZ);
  LoRa.setCodingRate4(RADIO_CODING_RATE); LoRa.setSyncWord(RADIO_SYNC_WORD);
  LoRa.setTxPower(RADIO_TX_POWER_DBM); LoRa.enableCrc(); LoRa.onTxDone(onTxDone);
  sessionId = esp_random(); radioReady = true; LoRa.receive();
}
void loop() {
#if SYNAPSE_GROUND
  if (!gatewayStarted) { delay(10); return; }
  websocket.loop();
  while (Serial.available()) {
    const char c = char(Serial.read());
    if (c == '\n') {
      if (!discardLine && uartLine.length()) {
        JsonDocument value;
        if (!deserializeJson(value, uartLine)) {
          const String type = value["type"] | "";
          if ((type == "set_mode" || type == "request_data") && value["version"].as<int>() == 1 && value["commandId"].is<const char*>() && value["missionId"].is<const char*>()) {
            if (!queueMessage(uartLine)) Serial.println("Radio busy: command not queued");
          }
        }
      }
      uartLine = ""; discardLine = false;
    } else if (c != '\r' && !discardLine) {
      uartLine += c;
      if (uartLine.length() > SynapseRadio::MaxMessage) { uartLine = ""; discardLine = true; }
    }
  }
  if (uint32_t(millis() - lastStatus) > 5000) {
    lastStatus = millis();
    for (uint8_t client = 0; client < WEBSOCKETS_SERVER_CLIENT_MAX; client++) if (authenticated[client]) sendStatus(client);
  }
#else
  while (Serial2.available()) {
    const char c = char(Serial2.read());
    if (c == '\n') { if (!discardLine && uartLine.length()) processLine(uartLine); uartLine = ""; discardLine = false; }
    else if (c != '\r' && !discardLine) {
      uartLine += c;
      if (uartLine.length() > SynapseRadio::MaxMessage) { uartLine = ""; discardLine = true; Serial.println("OBC line too large"); }
    }
  }
#endif
  if (radioReady) serviceRadio();
}
