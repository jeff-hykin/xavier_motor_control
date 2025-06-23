#include <SoftwareSerial.h>

#define DBUS_RX 10  // Choose a pin that supports change interrupts

SoftwareSerial dbusSerial(DBUS_RX, -1, true); // RX only

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

const int REMOTE_BUF_LEN = 18;
const int REMOTE_DISCONNECT_TIMEOUT = 100;
const float ANALOG_MAX_VALUE = 660;  ///< Max value received by one of the sticks. 
const int16_t GAMEPAD_JOYSTICK_MAX_VALUE = 32767; 

enum Switch {
  LEFT_SWITCH,  
  RIGHT_SWITCH  
};

enum SwitchState {
  UNKNOWN,
  UP,
  DOWN,
  MID
};

struct RemoteInfo {
  uint32_t updateCounter = 0;
  int16_t rightHorizontal = 0;
  int16_t rightVertical = 0;
  int16_t leftHorizontal = 0;
  int16_t leftVertical = 0;
  SwitchState leftSwitch = SwitchState::UNKNOWN;
  SwitchState rightSwitch = SwitchState::UNKNOWN;
  /// Mouse information
  struct
  {
      int16_t x = 0;
      int16_t y = 0;
      int16_t z = 0;
      bool l = false;
      bool r = false;
  } mouse;
  uint16_t key = 0;   ///< Keyboard information
  int16_t wheel = 0;  ///< Remote wheel information
};

const int message_max_size = sizeof(RemoteInfo);
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
            printByteBinary(data[2]);
            Serial.print(" ");
        }
        // Serial.print("index:");
        // Serial.print(index);
        // Serial.print("\n");
        index = 0;
        memset(data, 0, sizeof(data));
    }
  }
}