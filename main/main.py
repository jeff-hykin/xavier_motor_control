from ctypes import Structure, c_uint8, c_float, c_bool
import serial
from time import time

# 
# config
#
timeout = 0.05
serial_baudrate = 115200
serial_port = "/dev/ttyTHS0" 

def setup_serial_port():
    print('') # spacer
    if not serial_port:
        print('[Communication]: Port=None so no communication')
        return None # disable port
    else:
        print(f'[Communication]: Port={serial_port}')
        try:
            return serial.Serial(
                serial_port,
                baudrate=baudrate,
                timeout=config.communication.timeout,
                bytesize=serial.EIGHTBITS,
                parity=serial.PARITY_NONE,
                stopbits=serial.STOPBITS_ONE
            )
        except Exception as error:
            import subprocess
            # very bad hack but it works
            # FIXME
            subprocess.run([ "bash", "-c", f"sudo -S chmod 777 '{serial_port}' <<<  \"$(cat \"$HOME/.pass\")\" ",])
            return setup_serial_port() # recursion until it works

# 
# initialize
# 
port = setup_serial_port()

# C++ struct
class MessageToEmbedded(Structure):
    _pack_ = 1
    _fields_ = [
        ("magic_number"    , c_uint8   ),
        ("X"               , c_float   ),
        ("Y"               , c_float   ),
        ("Z"               , c_float   ),
        ("capture_delay"   , c_uint8   ),
        ("status"          , c_uint8   ),
    ]

message_to_embedded = MessageToEmbedded(ord('a'), 0.0, 0.0, 0.0, 0, 0)

def aim_at(x, y, z):
    global port
    capture_delay = 1

    # Sending XYZ position (meters), time since frame capture, and status of target relative to front of camera plane
    message_to_embedded.X = float(x)
    message_to_embedded.Y = float(y)
    message_to_embedded.Z = float(z)
    message_to_embedded.capture_delay = capture_delay
    message_to_embedded.status = 1
    
    try:
        port.write(bytes(message_to_embedded))
    except Exception as error:
        print(f"\n[Communication]: error when writing over UART: {error}")
        port = setup_serial_port() # attempt re-setup