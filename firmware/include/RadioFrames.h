#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>

namespace SynapseRadio {
constexpr size_t MaxMessage = 4096;
constexpr size_t Chunk = 200;
constexpr size_t Header = 20;
constexpr uint32_t AssemblyTimeout = 180000;
inline uint32_t crc32(const uint8_t* bytes, size_t length) {
  uint32_t crc = 0xffffffff;
  for (size_t i = 0; i < length; i++) {
    crc ^= bytes[i];
    for (int j = 0; j < 8; j++) crc = (crc >> 1) ^ (0xedb88320u & (0u - (crc & 1)));
  }
  return ~crc;
}
inline uint32_t get32(const uint8_t* p) { return uint32_t(p[0]) | uint32_t(p[1]) << 8 | uint32_t(p[2]) << 16 | uint32_t(p[3]) << 24; }
inline void put32(uint8_t* p, uint32_t value) { for (int i = 0; i < 4; i++) p[i] = uint8_t(value >> (8 * i)); }
inline size_t encode(const uint8_t* message, size_t length, uint32_t session, uint32_t id, uint8_t direction, uint8_t index, uint8_t* output) {
  if (!length || length > MaxMessage || direction > 1 || size_t(index) * Chunk >= length) return 0;
  output[0] = 'S'; output[1] = 'Y'; output[2] = 1; output[3] = direction;
  put32(output + 4, session); put32(output + 8, id);
  output[12] = uint8_t(length); output[13] = uint8_t(length >> 8);
  output[14] = index; output[15] = uint8_t((length + Chunk - 1) / Chunk);
  put32(output + 16, crc32(message, length));
  size_t count = length - size_t(index) * Chunk;
  if (count > Chunk) count = Chunk;
  memcpy(output + Header, message + size_t(index) * Chunk, count);
  return Header + count;
}
class Assembler {
  uint8_t data_[MaxMessage + 1] = {};
  uint32_t session_ = 0, id_ = 0, crc_ = 0, seen_ = 0, started_ = 0;
  size_t length_ = 0;
  uint8_t count_ = 0;
  bool active_ = false, completed_ = false;
public:
  const char* data() const { return reinterpret_cast<const char*>(data_); }
  size_t size() const { return length_; }
  bool accept(const uint8_t* frame, size_t size, uint8_t direction, uint32_t now) {
    if (size <= Header || frame[0] != 'S' || frame[1] != 'Y' || frame[2] != 1 || frame[3] != direction) return false;
    const size_t length = frame[12] | size_t(frame[13]) << 8;
    const uint8_t index = frame[14], count = frame[15];
    if (!length || length > MaxMessage || count != (length + Chunk - 1) / Chunk || index >= count) return false;
    size_t bytes = length - size_t(index) * Chunk;
    if (bytes > Chunk) bytes = Chunk;
    if (size != Header + bytes) return false;
    const uint32_t session = get32(frame + 4), id = get32(frame + 8), crc = get32(frame + 16);
    if (active_ && uint32_t(now - started_) > AssemblyTimeout) active_ = false;
    if (!active_ || session != session_ || id != id_) {
      if (completed_ && session == session_ && id == id_) return false;
      session_ = session; id_ = id; crc_ = crc; length_ = length; count_ = count;
      seen_ = 0; started_ = now; active_ = true; completed_ = false;
    }
    if (length != length_ || crc != crc_ || count != count_) return false;
    const size_t offset = size_t(index) * Chunk;
    if (seen_ & (uint32_t(1) << index)) {
      if (memcmp(data_ + offset, frame + Header, bytes) != 0) active_ = false;
      return false;
    }
    memcpy(data_ + offset, frame + Header, bytes); seen_ |= uint32_t(1) << index;
    if (seen_ != ((uint32_t(1) << count_) - 1)) return false;
    active_ = false;
    if (crc32(data_, length_) != crc_) return false;
    data_[length_] = 0; completed_ = true; return true;
  }
};
}
