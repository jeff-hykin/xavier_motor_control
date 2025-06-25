import can
import time
from ctypes import Structure, c_uint8, c_uint16, c_float, c_bool, c_int8, c_int16
from ctypes import BigEndianStructure, LittleEndianStructure

# following this guide: https://canable.io/getting-started.html

# Stock slcan firmware on Linux
bus = can.interface.Bus(interface='slcan', channel='/dev/tty.usbmodem207B307153301', bitrate=1_000_000)
bus = can.interface.Bus(interface='slcan', channel='/dev/tty.usbmodem207B307153301', bitrate=1_000_000)

# can.Message(timestamp=1750719775.151558, arbitration_id=0x206, is_extended_id=False, dlc=8, data=[0x15, 0x77, 0x0, 0x0, 0xff, 0x7c, 0x1c, 0x0])

# Data Field Description
# DATA[0] Controls the rotor mechanical angle in higher order byte (8 bits)
# DATA[1] Controls the rotor mechanical angle in lower order byte (8 bits)
# DATA[2] Controls the rotational speed in higher order byte (8 bits)
# DATA[3] Controls the rotational speed in lower order byte (8 bits)
# DATA[4] Actual torque current in higher order byte (8 bits)
# DATA[5] Actual torque current in lower order byte (8 bits)
# straight from the docs: https://rm-static.djicdn.com/tem/17348/RM%20GM6020%20%E4%BD%BF%E7%94%A8%E8%AF%B4%E6%98%8E%EF%BC%88%E8%8B%B1%EF%BC%8920231103.pdf
# "The controllable current range is -16,384 to 0 to 16,384 and the corresponding maximum torque"
# "current range is -3 A to 0 to 3 A"

class MessageFromDjiGM6020(LittleEndianStructure): # little endian is correct
    _pack_ = 1
    _fields_ = [
        ("angle"      , c_uint16  ), # 0 - 8191 mechanical angle
        ("speed"      , c_int16  ),
        ("current"    , c_int16  ),
        ("temperature", c_uint8   ),
        ("null"       , c_uint8   ),
    ]
    
    def __repr__(self):
        if not hasattr(self, "id"):
            self.id = None
        
        if not hasattr(self, "timestamp"):
            self.timestamp = None
            
        return f'''angle = {self.angle}, speed = {self.speed}, current = {self.current}, temperature = {self.temperature}, id = {self.id}, timestamp = {self.timestamp}'''

def get_message():
    message = bus.recv(timeout=50)
    if message is None:
        return None
        
    encoder_actual = int.from_bytes(message.data[0:2], byteorder='big', signed=False)
    shaft_rpm      = int.from_bytes(message.data[2:4], byteorder='big', signed=True)
    torque         = int.from_bytes(message.data[4:6], byteorder='big', signed=True)
    temperature    = int.from_bytes(message.data[6:7], byteorder='big', signed=True)
    print(f'''message = {message}''')
    # help(message)
    m = MessageFromDjiGM6020(encoder_actual, shaft_rpm, torque, temperature)
    m.id = message.arbitration_id
    m.timestamp = message.timestamp
    print(f'''message.arbitration_id = {message.arbitration_id}''')
    print(f'''message.is_remote_frame = {message.is_remote_frame}''')
    print(f'''message.channel = {message.channel}''')
    print(f'''message.dlc = {message.dlc}''')
    print(f'''message.is_fd = {message.is_fd}''')
    print(f'''message.is_rx = {message.is_rx}''')
    print(f'''message.bitrate_switch = {message.bitrate_switch}''')
    print(f'''message.error_state_indicator = {message.error_state_indicator}''')
    # print(f'''message.check = {message.check}''')
    return m

def set_speed_message(speed):
    # Simulate a signed 16-bit int
    desired_output = c_int16(speed).value  # value in range -32768 to 32767
    
    # Extract high and low bytes (big-endian)
    high_byte = (desired_output >> 8) & 0xFF
    low_byte = desired_output & 0xFF

    # Store in a bytearray at index based on id
    tx_message = bytearray(8)  # CAN message payload, typically 8 bytes
    for motor_id in range(0, 4):
        tx_message[2 * motor_id] =  low_byte
        tx_message[2 * motor_id + 1] = high_byte
    
    return tx_message
    
# int16_t desiredOutput;
# id %= 4;
# txMessage->data[2 * id] = desired_output >> 8;

# class UnpackedMessageFromDjiGM6020(LittleEndianStructure):
#     _pack_ = 1
#     _fields_ = [
#         ("angle1"     , c_uint8   ),
#         ("angle2"     , c_uint8   ),
#         ("speed1"     , c_uint8   ),
#         ("speed2"     , c_uint8   ),
#         ("current1"   , c_int8   ),
#         ("current2"   , c_int8   ),
#         ("temperature", c_uint8   ),
#         ("null"       , c_uint8   ),
#     ]

# class MessageFromDjiGM6020(LittleEndianStructure):
#     _pack_ = 1
#     _fields_ = [
#         ("angle"      , c_uint16  ), # 0 - 8191 mechanical angle
#         ("speed"      , c_int16  ),
#         ("current"    , c_int16  ),
#         ("temperature", c_uint8   ),
#         ("null"       , c_uint8   ),
#     ]

# def convert_unpacked_to_packed(unpacked):
#     packed = MessageFromDjiGM6020()
    
#     # Combine high and low bytes into 16-bit integers (big-endian)
#     packed.angle  = (unpacked.angle1  << 8) | unpacked.angle2
#     packed.speed  = (unpacked.speed1  << 8) | unpacked.speed2
#     packed.current= (unpacked.current1<< 8) | unpacked.current2
#     packed.temperature = unpacked.temperature
#     packed.null = unpacked.null

#     return packed


class MessageToDjiGM6020(Structure):
    _pack_ = 1
    # 25,000 to 0 to 25,000.
    _fields_ = [
        ("voltage1", c_int16),
        ("voltage2", c_int16),
        ("voltage3", c_int16),
        ("voltage4", c_int16),
    ]

# message = convert_unpacked_to_packed(MessageFromDjiGM6020.from_buffer(bus.recv(timeout=1).data))

MOTOR1 = 0X201
MOTOR2 = 0x202
MOTOR3 = 0x203
MOTOR4 = 0x204
MOTOR5 = 0x205
MOTOR6 = 0x206
MOTOR7 = 0x207
MOTOR8 = 0x208

message_id = 0x1FF
message_id2 = 0x2FF
message_id3 = 0X1FE 
message_id4 = 0X2FE

arbitration_id = 0x206
driver_id = arbitration_id-0x204


msg = can.Message(arbitration_id=arbitration_id, data=bytes(set_speed_message(100)))
bus.send(can.Message(arbitration_id=arbitration_id, data=bytes(set_speed_message(100))))
try:
    bus.send(msg)
    print("Message sent on {}".format(bus.channel_info))
except can.CanError:
    pass
    
while 1:
    time.sleep(0.1)
    # m = UnpackedMessageFromDjiGM6020.from_buffer(bus.recv(timeout=1).data)
    m = get_message()
    # print(f'''m.angle = {m.angle1}''')
    # print(f'''m.angle = {m.angle2}''')
    # print(f'''m.speed = {m.speed1}''')
    # print(f'''m.speed = {m.speed2}''')
    # print(f'''m.current = {m.current1}''')
    # print(f'''m.current = {m.current2}''')
    # print(f'''m.temperature = {m.temperature}''')
    # m = convert_unpacked_to_packed(m)
    print(f'''m.angle = {m.angle}''')
    print(f'''m.speed = {m.speed}''')
    print(f'''m.current = {m.current}''')
    print(f'''m.temperature = {m.temperature}''')
while 1:
    print(bus.recv(timeout=1).data)