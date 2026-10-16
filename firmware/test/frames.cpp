#include "RadioFrames.h"
#include <assert.h>
#include <vector>
#include <stdio.h>
using namespace SynapseRadio;
int main() {
  assert(crc32(reinterpret_cast<const uint8_t*>("123456789"), 9) == 0xcbf43926);
  for (size_t size : {size_t(1), size_t(200), size_t(201), size_t(4096)}) {
    std::vector<uint8_t> message(size);
    for (size_t i = 0; i < size; i++) message[i] = uint8_t(i % 251);
    Assembler rx;
    const size_t total = (size + Chunk - 1) / Chunk;
    for (size_t i = total; i > 0; i--) {
      uint8_t frame[255]; const size_t count = encode(message.data(), size, 1, 10, 0, i - 1, frame);
      assert(count && count <= 255);
      assert(!rx.accept(frame, count, 1, 100));
      bool complete = rx.accept(frame, count, 0, 100);
      assert(complete == (i == 1));
      assert(!rx.accept(frame, count, 0, 101));
    }
    assert(rx.size() == size && !memcmp(rx.data(), message.data(), size));
  }
  uint8_t message[201] = {}, frame[255], next[255];
  size_t first = encode(message, 201, 2, 1, 0, 0, frame);
  size_t last = encode(message, 201, 2, 1, 0, 1, next);
  Assembler corrupt;
  frame[Header] ^= 1;
  assert(!corrupt.accept(frame, first, 0, 0));
  assert(!corrupt.accept(next, last, 0, 1));
  frame[Header] ^= 1;
  Assembler missing;
  assert(!missing.accept(frame, first - 1, 0, 0));
  assert(!missing.accept(frame, first, 0, 0));
  assert(!missing.accept(next, last, 0, AssemblyTimeout + 1));
  assert(missing.accept(frame, first, 0, AssemblyTimeout + 2));
  assert(encode(message, 0, 1, 1, 0, 0, frame) == 0);
  assert(encode(message, MaxMessage + 1, 1, 1, 0, 0, frame) == 0);
  assert(encode(message, 201, 1, 1, 0, 2, frame) == 0);
  puts("Radio framing tests passed");
}
