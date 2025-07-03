from ctypes import Structure, c_uint8, c_float, c_bool, c_int8
import ctypes
import serial # pip install pyserial
from time import sleep
import struct

# 
# config
# 
serial_port    = "/dev/ttyTHS0" # this depends on your system (ex: raspberry pi, nvidia jetson) and which port you physically connect to the arduino
UART_BAUD_RATE = 115200         # needs to be the same as the arduino file (115200 default)
timeout        = 0.05 # seconds?, doesn't really matter


# 
# initialize
# 
port = serial.Serial(
    serial_port,
    baudrate=UART_BAUD_RATE,
    timeout=timeout,
    bytesize=serial.EIGHTBITS,
    parity=serial.PARITY_NONE,
    stopbits=serial.STOPBITS_ONE
)

# C struct (matches whats in the arduino)
class MessageToEmbedded(ctypes.LittleEndianStructure):
    _pack_ = 1
    _fields_ = [
        ("which_motor"   , ctypes.c_uint8  ), # 0 to 3, (arduino code could be updated to handle 0 to 7, see TODO in there)
        ("velocity"      , ctypes.c_int8   ), # 128 is the max power in counter clockwise direction from the top, -128 is the max power clockwise
        ("uart_send_rate", ctypes.c_uint32 ), # NOTE: if you make this too low it will NOT ONLY overwhelm the python script, but eventually overwhelm the OS message queue and make the data corrupt
                                              #       set this rate based on how fast the python can receive messages
    ]

# C struct (matches whats in the arduino)
class UartMessageFromMotor(ctypes.LittleEndianStructure):
    _pack_ = 1
    _fields_ = [
        ("canbus_id", ctypes.c_uint32),
        ("motor_id", ctypes.c_uint8),
        ("can_dlc", ctypes.c_uint8),
        ("angle_degrees", ctypes.c_float),
        ("rpm", ctypes.c_int16),
        ("discharge_rate", ctypes.c_int16), # no idea what units
        ("temperature_celsius", ctypes.c_uint8),
        ("timestamp_milliseconds", ctypes.c_uint32),
    ]
    
    def __repr__(self):
        return f"id: {self.motor_id}, can_dlc:{self.can_dlc}, angle_degrees:{self.angle_degrees}, rpm:{self.rpm}, discharge_rate:{self.discharge_rate}, temperature_celsius:{self.temperature_celsius}, timestamp_milliseconds:{self.timestamp_milliseconds}"


def parse_uart_message_or_return_none(raw_message):
    if len(raw_message) == ctypes.sizeof(UartMessageFromMotor):
        message = UartMessageFromMotor.from_buffer_copy(raw_message)
        # check if null/bad message
        if message.canbus_id != 0:
            return message
    
# 
# main
#
while 1:
    # port.write(bytes(MessageToEmbedded(0, 20, 1000)))
    raw_message = port.read(ctypes.sizeof(UartMessageFromMotor))
    message = parse_uart_message_or_return_none(raw_message)
    if message:
        print(f'''message = {message}''')
    sleep(1)