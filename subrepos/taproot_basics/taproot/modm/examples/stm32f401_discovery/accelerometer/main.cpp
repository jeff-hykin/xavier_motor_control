/*
 * Copyright (c) 2015, Kevin Läufer
 * Copyright (c) 2015-2018, Niklas Hauser
 * Copyright (c) 2024, Carl Treudler
 *
 * This file is part of the modm project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
// ----------------------------------------------------------------------------

#include <modm/board.hpp>
#include <modm/processing.hpp>
#include <modm/math/filter.hpp>

using namespace Board;

// create the data object
Board::lsm3::Accelerometer::Data data;
// and hand it to the sensor driver
Board::lsm3::Accelerometer accelerometer(data);


class ReaderThread : public modm::pt::Protothread
{
public:
	bool
	update()
	{
		PT_BEGIN();

		// initialize with limited range of ±2g
		PT_CALL(accelerometer.configure(accelerometer.Scale::G2));

		while (true)
		{
			// read out the sensor
			PT_CALL(accelerometer.readAcceleration());

			averageX.update(accelerometer.getData().getX());
			averageY.update(accelerometer.getData().getY());

			{
				bool xs = averageX.getValue() < -0.2f;
				bool xn = averageX.getValue() >  0.2f;

				bool xe = averageY.getValue() < -0.2f;
				bool xw = averageY.getValue() >  0.2f;


				LedBlue::set(xs); // South
				LedGreen::set(xw); //West
				LedOrange::set(xn); // North
				LedRed::set(xe); // East
			}

			// repeat every 5 ms
			timeout.restart(5ms);
			PT_WAIT_UNTIL(timeout.isExpired());
		}

		PT_END();
	}

private:
	modm::ShortTimeout timeout;
	modm::filter::MovingAverage<float, 25> averageX;
	modm::filter::MovingAverage<float, 25> averageY;
};

ReaderThread reader;

int
main()
{
	Board::initialize();
	Board::initializeLsm3();

	Leds::set();
	modm::delay(42ms);

	modm::fiber::Scheduler::run();

	return 0;
}
