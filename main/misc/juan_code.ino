#include <Arduino.h>
#include <BleGamepad.h>
#include <math.h>

#define RXD2 16
#define TXD2 17

const int REMOTE_BUF_LEN = 18;
const int REMOTE_DISCONNECT_TIMEOUT = 100;
const float ANALOG_MAX_VALUE = 660;  ///< Max value received by one of the sticks. 
const int16_t GAMEPAD_JOYSTICK_MAX_VALUE = 32767; 

enum Switch
{
  LEFT_SWITCH,  
  RIGHT_SWITCH  
};

enum SwitchState
{
  UNKNOWN,
  UP,
  DOWN,
  MID
};

struct RemoteInfo
{
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

BleGamepad bleGamepad("RoboMaster DJI Controller", "ur mom hehe");
RemoteInfo remote;

unsigned long lastRead = 0; 
bool connected = false;
uint8_t rxBuffer[REMOTE_BUF_LEN]{0};
uint8_t currentBufferIndex = 0;

void setup()
{
    Serial.begin(115200);
    Serial.println("Starting BLE work!");
    Serial1.begin(100000, SERIAL_8E1, RXD2, TXD2); // UART
    Serial1.setTimeout(6); // milliseconds
    bleGamepad.begin();
    // The default bleGamepad.begin() above enables 16 buttons, all axes, one hat, and no simulation controls or special buttons
}

void loop()
{
    if (bleGamepad.isConnected())
    {
        updateRemoteValues();

        Serial.println("Updating gamepad state based on remote values.");
        switch (remote.leftSwitch)
        {
            case SwitchState::DOWN:
                bleGamepad.press(BUTTON_1);
                bleGamepad.release(BUTTON_2);
                bleGamepad.release(BUTTON_3);
                break;
            case SwitchState::MID:
                bleGamepad.press(BUTTON_2);
                bleGamepad.release(BUTTON_1);
                bleGamepad.release(BUTTON_3);
                break;
            case SwitchState::UP:
                bleGamepad.press(BUTTON_3);
                bleGamepad.release(BUTTON_2);
                bleGamepad.release(BUTTON_1);
                break;
            default:
                bleGamepad.release(BUTTON_1);
                bleGamepad.release(BUTTON_2);
                bleGamepad.release(BUTTON_3);
        }

        switch (remote.rightSwitch)
        {
            case SwitchState::DOWN:
                bleGamepad.press(BUTTON_4);
                bleGamepad.release(BUTTON_5);
                bleGamepad.release(BUTTON_6);
                break;
            case SwitchState::MID:
                bleGamepad.press(BUTTON_5);
                bleGamepad.release(BUTTON_4);
                bleGamepad.release(BUTTON_6);
                break;
            case SwitchState::UP:
                bleGamepad.press(BUTTON_6);
                bleGamepad.release(BUTTON_4);
                bleGamepad.release(BUTTON_5);
                break;
            default:
                bleGamepad.release(BUTTON_4);
                bleGamepad.release(BUTTON_5);
                bleGamepad.release(BUTTON_6);
        }
        bleGamepad.pressStart();
        bleGamepad.releaseStart();

        bleGamepad.setLeftThumb(
            (int16_t)(round(((remote.leftHorizontal / ANALOG_MAX_VALUE) + 1) * GAMEPAD_JOYSTICK_MAX_VALUE / 2)),
            (int16_t)(round(((remote.leftVertical / -ANALOG_MAX_VALUE) + 1) * GAMEPAD_JOYSTICK_MAX_VALUE / 2))
        );

        bleGamepad.setRightThumbAndroid(
            (int16_t)(round(((remote.rightHorizontal / ANALOG_MAX_VALUE) + 1) * GAMEPAD_JOYSTICK_MAX_VALUE / 2)),
            (int16_t)(round(((remote.rightVertical / -ANALOG_MAX_VALUE) + 1) * GAMEPAD_JOYSTICK_MAX_VALUE / 2))
        );
    }
}

void updateRemoteValues()
{
    if (millis() - lastRead > REMOTE_DISCONNECT_TIMEOUT)
    {
        connected = false;
        reset();
    }
    uint8_t byteCount = 0;
    byteCount = Serial1.readBytes(rxBuffer, REMOTE_BUF_LEN);
    if (byteCount > 0)
    {
        lastRead = millis();
    }

    if (byteCount == REMOTE_BUF_LEN)
    {
        connected = true;
        parseBuffer();
        clearRXBuffer();
    } else
    {
        clearRXBuffer();
    }
}


void reset()
{
    remote.rightHorizontal = 0;
    remote.rightVertical = 0;
    remote.leftHorizontal = 0;
    remote.leftVertical = 0;
    remote.leftSwitch = SwitchState::UNKNOWN;
    remote.rightSwitch = SwitchState::UNKNOWN;
    remote.mouse.x = 0;
    remote.mouse.y = 0;
    remote.mouse.z = 0;
    remote.mouse.l = 0;
    remote.mouse.r = 0;
    remote.key = 0;
    remote.wheel = 0;
    clearRXBuffer();
}


void clearRXBuffer()
{
    currentBufferIndex = 0;
    for (int i = 0; i < REMOTE_BUF_LEN; i++)
    {
        rxBuffer[i] = 0;
    }
}


void parseBuffer()
{
    remote.rightHorizontal = (rxBuffer[0] | rxBuffer[1] << 8) & 0x07FF;
    remote.rightHorizontal -= 1024;
    remote.rightVertical = (rxBuffer[1] >> 3 | rxBuffer[2] << 5) & 0x07FF;
    remote.rightVertical -= 1024;
    remote.leftHorizontal = (rxBuffer[2] >> 6 | rxBuffer[3] << 2 | rxBuffer[4] << 10) & 0x07FF;
    remote.leftHorizontal -= 1024;
    remote.leftVertical = (rxBuffer[4] >> 1 | rxBuffer[5] << 7) & 0x07FF;
    remote.leftVertical -= 1024;
    
    remote.leftSwitch = static_cast<SwitchState>((rxBuffer[5] >> 6) & 0x03);
    remote.rightSwitch = static_cast<SwitchState>((rxBuffer[5] >> 4) & 0x03);

    // mouse input
    remote.mouse.x = rxBuffer[6] | (rxBuffer[7] << 8);    // x axis
    remote.mouse.y = rxBuffer[8] | (rxBuffer[9] << 8);    // y axis
    remote.mouse.z = rxBuffer[10] | (rxBuffer[11] << 8);  // z axis
    remote.mouse.l = static_cast<bool>(rxBuffer[12]);     // left button click
    remote.mouse.r = static_cast<bool>(rxBuffer[13]);     // right button click

    // the remote joystick and wheel values must be <= abs(660)
    if ((abs(remote.rightHorizontal) > ANALOG_MAX_VALUE) ||
        (abs(remote.rightVertical) > ANALOG_MAX_VALUE) ||
        (abs(remote.leftHorizontal) > ANALOG_MAX_VALUE) ||
        (abs(remote.leftVertical) > ANALOG_MAX_VALUE) || (abs(remote.wheel) > ANALOG_MAX_VALUE))
    {
        Serial.println("ERRORR: joystick or wheels vlaues are greater than their max value.");
    }


    // keyboard capture
    remote.key = rxBuffer[14] | rxBuffer[15] << 8;
    // remote wheel
    remote.wheel = (rxBuffer[16] | rxBuffer[17] << 8) - 1024;

    remote.updateCounter++;
}

