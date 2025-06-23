import can
from ctypes import Structure, c_uint8, c_float, c_bool

# Stock slcan firmware on Linux
bus = can.interface.Bus(interface='slcan', channel='/dev/tty.usbmodem207B307153301', bitrate=1_000_000)

# can.Message(timestamp=1750719775.151558, arbitration_id=0x206, is_extended_id=False, dlc=8, data=[0x15, 0x77, 0x0, 0x0, 0xff, 0x7c, 0x1c, 0x0])

# Data Field Description
# DATA[0] Controls the rotor mechanical angle in higher order byte (8 bits)
# DATA[1] Controls the rotor mechanical angle in lower order byte (8 bits)
# DATA[2] Controls the rotational speed in higher order byte (8 bits)
# DATA[3] Controls the rotational speed in lower order byte (8 bits)
# DATA[4] Actual torque current in higher order byte (8 bits)
# DATA[5] Actual torque current in lower order byte (8 bits)
class MessageFromDjiGM6020(Structure):
    _pack_ = 1
    _fields_ = [
        ("angle1"     , c_uint8   ),
        ("angle2"     , c_uint8   ),
        ("speed1"     , c_uint8   ),
        ("speed2"     , c_uint8   ),
        ("current1"   , c_uint8   ),
        ("current2"   , c_uint8   ),
        ("temperature", c_uint8   ),
        ("null"       , c_uint8   ),
    ]

message_to_embedded = MessageToEmbedded(ord('a'), 0.0, 0.0, 0.0, 0, 0)

# try:
#     msg = can.Message(arbitration_id=0xc0ffee, data=[0, 25, 0, 1, 3, 1, 4, 1], is_extended_id=True)
#     bus.send(msg)
#     print("Message sent on {}".format(bus.channel_info))
# except can.CanError:
#     pass