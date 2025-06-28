from ctypes import Structure, c_uint8, c_float, c_bool, c_int8
import ctypes
import serial # pip install pyserial
from time import sleep
import struct

# 
# config
# 
serial_port  = "/dev/ttyTHS0"
baudrate     = 9600
timeout      = 0.05

# 
# initialize
# 
port = serial.Serial(
    serial_port,
    baudrate=baudrate,
    timeout=timeout,
    bytesize=serial.EIGHTBITS,
    parity=serial.PARITY_NONE,
    stopbits=serial.STOPBITS_ONE
)

# C++ struct
class MessageToEmbedded(Structure):
    _pack_ = 1
    _fields_ = [
        ("which_motor" , c_uint8   ), # 0 to 3
        ("velocity"    , c_int8   ), # 128 is the max power in counter clockwise direction from the top, -128 is the max power clockwise
    ]

# UartMessageFromMotor.from_buffer_copy(b'\x05\x02\x00\x00\x08\xe8\x08\x00\x00\xd7\xff\x1d;q\x08\x00')
class UartMessageFromMotor(ctypes.LittleEndianStructure):
    _pack_ = 1
    _fields_ = [
        ("id", ctypes.c_uint32),
        ("can_dlc", ctypes.c_uint8),
        ("angle", ctypes.c_uint16),
        ("rpm", ctypes.c_int16),
        ("current", ctypes.c_int16),
        ("temperature", ctypes.c_uint8),
        ("timestamp", ctypes.c_uint32),
    ]
    
    def __repr__(self):
        return f"id: {self.id}, can_dlc:{self.can_dlc}, angle:{self.angle}, rpm:{self.rpm}, current:{self.current}, temperature:{self.temperature}, timestamp:{self.timestamp}"


def parse_uart_message(bytes_obj):
    """
    Parse a raw bytes object into a UartMessageFromMotor struct.
    The bytes_obj must be exactly 16 bytes:
      - 4 bytes for id
      - 1 byte for can_dlc
      - 2 bytes for angle
      - 2 bytes for rpm
      - 2 bytes for current
      - 1 byte for temperature
      - 4 bytes for timestamp
    """

    # Confirm bytes_obj size is correct for a 32-bit unsigned long system (total = 16 bytes)
    expected_size = ctypes.sizeof(UartMessageFromMotor)
    if len(bytes_obj) != expected_size:
        raise ValueError(f"Invalid data size: expected {expected_size} bytes, got {len(bytes_obj)}")

    msg = UartMessageFromMotor()
    ctypes.memmove(ctypes.addressof(msg), bytes_obj, expected_size)
    return msg

# 
# main
#
while 1:
    port.write(bytes(MessageToEmbedded(0, 20)))
    raw_message = port.read(ctypes.sizeof(UartMessageFromMotor))
    if len(raw_message) == ctypes.sizeof(UartMessageFromMotor):
        message = UartMessageFromMotor.from_buffer_copy(raw_message)
        print(f'''message = {message}''')
        print(f'''raw_message = {raw_message}''')
    sleep(1)