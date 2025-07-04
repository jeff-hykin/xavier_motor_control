from ctypes import Structure, c_uint8, c_float, c_bool, c_int8
import ctypes
import serial # pip install pyserial
from time import sleep
import struct
import warnings
import sys

# 
# config
# 
serial_port    = "/dev/ttyTHS0" # this depends on your system (ex: raspberry pi, nvidia jetson) and which port you physically connect to the arduino
UART_BAUD_RATE = 57600          # needs to be the same as the arduino file (57600 default)
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
        ("_magic_number"   , ctypes.c_uint32 ), # always set to 0xDEADBEEF
        ("_checksum"       , ctypes.c_uint8  ), # sum of all the bytes as a sanity check (implemented after experiencing data corruption)
        ("_which_motor"   , ctypes.c_uint8  ), # 0 to 3, (arduino code could be updated to handle 0 to 7, see TODO in there)
        ("_velocity"      , ctypes.c_int8   ), # 128 is the max power in counter clockwise direction from the top, -128 is the max power clockwise
        ("_uart_send_rate_milliseconds", ctypes.c_uint32 ), # NOTE: if you make this too low it will NOT ONLY overwhelm the python script, but eventually overwhelm the OS message queue and make the data corrupt
                                              #       set this rate based on how fast the python can receive messages
    ]
    
    def __init__(self, which_motor, velocity, uart_send_rate_milliseconds=int((1/60)*1000)):
        super().__init__()  # important to call this
        self._magic_number = 0xDEADBEEF
        self._checksum = 0
        self.which_motor = which_motor
        self.velocity = velocity
        self.uart_send_rate_milliseconds = uart_send_rate_milliseconds
        
    def _recalculate_checksum(self):
        size_of_non_summed_fields = ctypes.sizeof(self._fields_[0][1])+ctypes.sizeof(self._fields_[1][1])
        self._checksum = 0
        for byte_index, each_byte in enumerate(bytes(self)):
            if byte_index >= size_of_non_summed_fields:
                self._checksum += int(each_byte)
    
    @property
    def which_motor(self): return self._which_motor
    @which_motor.setter
    def which_motor(self, value):
        assert value <= 3 and value >= 0, f"motor must have a value of 0,1,2,3 (must change arduino code to support motors 4,5,6,7), given value was {value}"
        self._which_motor = value
        self._recalculate_checksum()
    
    @property
    def velocity(self): return self._velocity
    @velocity.setter
    def velocity(self, value):
        assert value <= 128 and value >= -128, f"motor velocity must be between -128 and 128, it was {value}"
        self._velocity = value
        self._recalculate_checksum()
    
    @property
    def uart_send_rate_milliseconds(self): return self._uart_send_rate_milliseconds
    @uart_send_rate_milliseconds.setter
    def uart_send_rate_milliseconds(self, value):
        assert value >= 0, f"motor uart_send_rate_milliseconds must be >0, it was {value}"
        self._uart_send_rate_milliseconds = value
        self._recalculate_checksum()

# C struct (matches whats in the arduino)
class UartMessageFromMotor(ctypes.LittleEndianStructure):
    _pack_ = 1
    _fields_ = [
        ("communication_corruption_detected", ctypes.c_uint8),
        
        ("canbus_id_0", ctypes.c_uint32),
        ("can_dlc_0", ctypes.c_uint8),
        ("angle_degrees_0", ctypes.c_float),
        ("rpm_0", ctypes.c_int16),
        ("discharge_rate_0", ctypes.c_int16), # no idea what units
        ("temperature_celsius_0", ctypes.c_uint8),
        ("timestamp_milliseconds_0", ctypes.c_uint32),
        
        ("canbus_id_1", ctypes.c_uint32),
        ("can_dlc_1", ctypes.c_uint8),
        ("angle_degrees_1", ctypes.c_float),
        ("rpm_1", ctypes.c_int16),
        ("discharge_rate_1", ctypes.c_int16), # no idea what units
        ("temperature_celsius_1", ctypes.c_uint8),
        ("timestamp_milliseconds_1", ctypes.c_uint32),
        
        ("canbus_id_2", ctypes.c_uint32),
        ("can_dlc_2", ctypes.c_uint8),
        ("angle_degrees_2", ctypes.c_float),
        ("rpm_2", ctypes.c_int16),
        ("discharge_rate_2", ctypes.c_int16), # no idea what units
        ("temperature_celsius_2", ctypes.c_uint8),
        ("timestamp_milliseconds_2", ctypes.c_uint32),
        
        ("canbus_id_3", ctypes.c_uint32),
        ("can_dlc_3", ctypes.c_uint8),
        ("angle_degrees_3", ctypes.c_float),
        ("rpm_3", ctypes.c_int16),
        ("discharge_rate_3", ctypes.c_int16), # no idea what units
        ("temperature_celsius_3", ctypes.c_uint8),
        ("timestamp_milliseconds_3", ctypes.c_uint32),
    ]
    
    def __repr__(self):
        magic_number_from_spec_sheet = 517
        can_ids = [self.canbus_id_0,self.canbus_id_1,self.canbus_id_2,self.canbus_id_3,]
        output = "("
        # print("repr")
        # print("list(range(magic_number_from_spec_sheet, len(can_ids)))",list(range(magic_number_from_spec_sheet, len(can_ids))))
        # print("can_ids",can_ids)
        # print("all",list(zip(range(magic_number_from_spec_sheet, magic_number_from_spec_sheet+len(can_ids)), can_ids)))
        for should_be_id, can_id in zip(range(magic_number_from_spec_sheet, magic_number_from_spec_sheet+len(can_ids)), can_ids):
            # print("    should_be_id", should_be_id)
            # print("    can_id", can_id)
            motor_index = should_be_id - magic_number_from_spec_sheet
            # print("    motor_index", motor_index)
            if should_be_id == can_id:
                output += f"\n    motor{motor_index}: angle_degrees:{getattr(self, f'angle_degrees_{motor_index}')}"
            # print("output",output)
        return output+"\n)"

    @staticmethod
    def parse_bytes_or_return_none(raw_message):
        # this can fail quite frequntly btw
        if len(raw_message) == ctypes.sizeof(UartMessageFromMotor):
            message = UartMessageFromMotor.from_buffer_copy(raw_message)
            if message.communication_corruption_detected > 0:
                # print("communication_corruption_detected!!",message.communication_corruption_detected)
                print(f"\n\nWhen sending/receiving a UART message, DATA CORRUPTION was detected\n(value={message.communication_corruption_detected}, higher=worse).Seeing this message long AFTER starting up can be dangerous (when the system has high-power motors).\nDecreasing baud rate can be an easy fix.\nIf that doesn't do the trick,\nthen there is likely a hardware problem with your system.\n", file=sys.stderr)
                # warnings.warn(f"\n\nWhen sending/receiving a UART message, DATA CORRUPTION was detected\n(value={message.communication_corruption_detected}, higher=worse).Seeing this message long AFTER starting up can be dangerous (when the system has high-power motors).\nDecreasing baud rate can be an easy fix.\nIf that doesn't do the trick,\nthen there is likely a hardware problem with your system.\n")
            return message
    
# 
# main
#
while 1:
    port.write(
        bytes(MessageToEmbedded(which_motor=1, velocity=0, uart_send_rate_milliseconds=1000))
    )
    # print(f'''wrote ''')
    raw_message = port.read(ctypes.sizeof(UartMessageFromMotor))
    # print(f'''len(raw_message) = {len(raw_message)}''')
    message = UartMessageFromMotor.parse_bytes_or_return_none(raw_message)
    if message:
        # print(raw_message)
        print(message)
    sleep(0.5)