from ctypes import Structure, c_uint8, c_float, c_bool
import serial # pip install pyserial
from time import sleep

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

message_to_embedded = MessageToEmbedded(0, 10)
# message_to_embedded = MessageToEmbedded(ord('a'), 0.0, 0.0, 0.0, 0, 0)

# 
# main
#
while 1:
    print(f'''port.readline() = {port.readline()}''')
    sleep(1)
    port.write(bytes(message_to_embedded))