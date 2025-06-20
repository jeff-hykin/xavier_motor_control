#include <SoftwareSerial.h>

#define DBUS_RX 10  // Choose a pin that supports change interrupts

SoftwareSerial dbusSerial(DBUS_RX, -1); // RX only

void setup() {
  Serial.begin(115200);        // For debug output
  dbusSerial.begin(100000);    // DBUS uses 100000 baud
}

uint16_t swap_endian_12bit(uint16_t value) {
    // Treat as 16-bit, swap high and low bytes
    return ((value & 0xFF) << 8) | ((value >> 8) & 0xFF);
}

void printByteBinary(uint8_t b) {
  for (int i = 7; i >= 0; i--) {
    Serial.print((b >> i) & 1);
    if (i == 3) {
      Serial.print("\t");
    }
  }
}

const int message_max_size = 18;
uint8_t data[message_max_size] = {0}; // message 
void loop() {
  int index = 0;
  while (dbusSerial.available()) {
    byte b = dbusSerial.read();
    if (index < message_max_size) {
      data[index++] = (uint8_t)b;
    }
    // Serial.print((int)b);
    // Serial.print("\t");
    if (0 == (int)b) {
        bool something_is_wrong = (index != 18);
        if (!something_is_wrong) {
            uint16_t first = (data[0] << 4) | (data[1] >> 4);
            uint16_t second = ((data[1] & 0x0F) << 8) | data[2];
            printByteBinary(data[0]);
            Serial.print(" ");
            printByteBinary(data[1]);
            Serial.print(" ");
        }
        // Serial.print("index:");
        // Serial.print(index);
        // Serial.print("\n");
        index = 0;
        memset(data, 0, sizeof(data));
    //   Serial.print("    ^in loop\n");
    //   Serial.print("    b:");
    //   Serial.print(b);
    //   Serial.print(" index:");
    //   Serial.print(index);
    //   bool something_went_wrong = index == message_max_size && b != 0;
    //   Serial.print(" something_went_wrong:");
    //   Serial.print(something_went_wrong);
    //   Serial.print("\n");
    //   // Serial.print("\n");
    //   if (something_went_wrong) { 
        uint16_t first = (data[0] << 4) | (data[1] >> 4);
        uint16_t second = ((data[1] & 0x0F) << 8) | data[2];

    //     // Serial.print("|");
    //     // // Change endianness (swap byte order of 12-bit-in-16-bit container)
    //     // uint16_t first_swapped = swap_endian_12bit(first);
    //     // uint16_t second_swapped = swap_endian_12bit(second);
    //     // printByteBinary(data[0]);
    //     // Serial.print(" ");
    //     // printByteBinary(data[1]);
    //     // Serial.print(" ");
    //     // printByteBinary(data[2]);
    //     // Serial.print(" ");
    //   }
    //   // Serial.print(first);
    //   // Serial.print(",");
    //   // Serial.print(second);
    //   // Serial.print("\n");
    //   // Serial.print(first_swapped);
    //   // Serial.print("|");
    //   // Serial.print(second_swapped);
    //   // Serial.print("\n");
    //   index = 0;
    //   memset(data, 0, sizeof(data));
    }
    // } else {
    //   index++;
    // }
  }
}