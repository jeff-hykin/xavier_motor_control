/*
 * Copyright (c) 2013-2014, Kevin Läufer
 * Copyright (c) 2014-2017, Niklas Hauser
 * Copyright (c) 2016, Fabian Greif
 *
 * This file is part of the modm project.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
// ----------------------------------------------------------------------------

#ifndef MODM_STM32_ADC3_HPP
#	error 	"Don't include this file directly, use 'adc_3.hpp' instead!"
#endif

#include <modm/platform/clock/rcc.hpp>
#include <modm/math/algorithm/prescaler.hpp>

template< class SystemClock, modm::frequency_t frequency, modm::percent_t tolerance >
void
modm::platform::Adc3::initialize()
{
	constexpr auto result = modm::Prescaler::from_list(SystemClock::Adc, frequency, {2,4,6,8});
	static_assert(result.frequency <= 36000000, "Generated ADC frequency is above maximum frequency!");
	assertBaudrateInTolerance<result.frequency, frequency, tolerance >();

	Rcc::enable<Peripheral::Adc3>();
	enable();  // switch on ADC

	setPrescaler(Prescaler{result.index});
}

void
modm::platform::Adc3::setPrescaler(const Prescaler prescaler)
{
	ADC->CCR = (ADC->CCR & ~ADC_CCR_ADCPRE) | (uint32_t(prescaler) << ADC_CCR_ADCPRE_Pos);
}

void
modm::platform::Adc3::enableTemperatureRefVMeasurement()
{
	ADC->CCR |= ADC_CCR_TSVREFE;
}

void
modm::platform::Adc3::disableTemperatureRefVMeasurement()
{
	ADC->CCR &= ~ADC_CCR_TSVREFE;
}
void
modm::platform::Adc3::setLeftAdjustResult()
{
	ADC3->CR2 |= ADC_CR2_ALIGN;
}

void
modm::platform::Adc3::setRightAdjustResult()
{
	ADC3->CR2 &= ~ADC_CR2_ALIGN;
}

bool
modm::platform::Adc3::setChannel(const Channel channel,
									 const SampleTime sampleTime)
{
	if (uint32_t(channel) > 18) return false;
	// clear number of conversions in the sequence
	// and set number of conversions to 1
	ADC3->SQR1 = 0;
	ADC3->SQR2 = 0;
	ADC3->SQR3 = uint32_t(channel) & 0x1f;

	setSampleTime(channel, sampleTime);
	if(channel == Channel::TemperatureSensor || channel == Channel::InternalReference)
	{
		enableTemperatureRefVMeasurement();
	}
	return true;
}

modm::platform::Adc3::Channel
modm::platform::Adc3::getChannel()
{
	return Channel(ADC3->SQR3 & 0x1f);
}

bool
modm::platform::Adc3::addChannel(const Channel channel,
									const SampleTime sampleTime)
{
	// read channel count
	uint8_t channel_count = (ADC3->SQR1 & ADC_SQR1_L) >> 20;
	++channel_count;
	if(channel_count > 0x0f) return false; // emergency exit
	// write channel number
	if(channel_count < 6) {
		ADC3->SQR3 |=
			(uint32_t(channel) & 0x1f) << (channel_count*5);
	} else 	if(channel_count < 12) {
		ADC3->SQR2 |=
			(uint32_t(channel) & 0x1f) << ((channel_count-6)*5);
	} else {
		ADC3->SQR1 |=
			(uint32_t(channel) & 0x1f) << ((channel_count-12)*5);
	}
	// update channel count
	ADC3->SQR1 = (ADC3->SQR1 & ~ADC_SQR1_L) | (channel_count << 20);

	setSampleTime(channel, sampleTime);
	if(channel == Channel::TemperatureSensor || channel == Channel::InternalReference)
	{
		enableTemperatureRefVMeasurement();
	}
	return true;
}

void
modm::platform::Adc3::setSampleTime(const Channel channel,
										const SampleTime sampleTime)
{
	if (uint32_t(channel) < 10) {
		ADC3->SMPR2 |= uint32_t(sampleTime)
								<< (uint32_t(channel) * 3);
	}
	else {
		ADC3->SMPR1 |= uint32_t(sampleTime)
								<< ((uint32_t(channel)-10) * 3);
	}
}

void
modm::platform::Adc3::enableFreeRunningMode()
{
	ADC3->CR2 |= ADC_CR2_CONT;	// set to continuous mode
}

void
modm::platform::Adc3::disableFreeRunningMode()
{
	ADC3->CR2 &= ~ADC_CR2_CONT;		// set to single mode
}

void
modm::platform::Adc3::disable()
{
	ADC3->CR2 &= ~(ADC_CR2_ADON);		// switch off ADC
	RCC->APB2ENR &= ~RCC_APB2ENR_ADC3EN; // stop ADC Clock
}

void
modm::platform::Adc3::enable()
{
	ADC3->CR2 |= ADC_CR2_ADON;  // switch on ADC
}

void
modm::platform::Adc3::startConversion()
{
	acknowledgeInterruptFlags(InterruptFlag::All);
	// starts single conversion for the regular group
	ADC3->CR2 |= ADC_CR2_SWSTART;
}

bool
modm::platform::Adc3::isConversionFinished()
{
	return (ADC3->SR & ADC_SR_EOC);
}

uint16_t
modm::platform::Adc3::getValue()
{
	return ADC3->DR;
}


uint16_t
modm::platform::Adc3::readChannel(Channel channel)
{
	if (!setChannel(channel)) return 0;

	startConversion();
	// wait until the conversion is finished
	while (!isConversionFinished())
		;

	return getValue();
}

// ----------------------------------------------------------------------------
void
modm::platform::Adc3::enableInterruptVector(const uint32_t priority,
												   const bool enable)
{
	const IRQn_Type InterruptVector = ADC_IRQn;
	if (enable) {
		NVIC_SetPriority(InterruptVector, priority);
		NVIC_EnableIRQ(InterruptVector);
	} else {
		NVIC_DisableIRQ(InterruptVector);
	}
}

void
modm::platform::Adc3::enableInterrupt(const Interrupt_t interrupt)
{
	ADC3->CR1 |= interrupt.value;
}

void
modm::platform::Adc3::disableInterrupt(const Interrupt_t interrupt)
{
	ADC3->CR1 &= ~interrupt.value;
}

modm::platform::Adc3::InterruptFlag_t
modm::platform::Adc3::getInterruptFlags()
{
	return InterruptFlag_t(ADC3->SR);
}

void
modm::platform::Adc3::acknowledgeInterruptFlags(const InterruptFlag_t flags)
{
	ADC3->SR = ~flags.value;
}

uintptr_t
modm::platform::Adc3::getDataRegisterAddress()
{
	return (uintptr_t) &(ADC3->DR);
}
void
modm::platform::Adc3::enableRegularConversionExternalTrigger(
	ExternalTriggerPolarity externalTriggerPolarity,
	RegularConversionExternalTrigger regularConversionExternalTrigger)
{
	const auto polarity =
		(static_cast<uint32_t>(externalTriggerPolarity) << ADC_CR2_EXTEN_Pos);
	const auto externalTrigger =
		(static_cast<uint32_t>(regularConversionExternalTrigger) << ADC_CR2_EXTSEL_Pos);
	const auto mask = ADC_CR2_EXTEN_Msk | ADC_CR2_EXTSEL_Msk;
	ADC3->CR2 = (ADC3->CR2 & ~mask) | polarity | externalTrigger;
}
void
modm::platform::Adc3::enableDmaMode()
{
	ADC3->CR2 |= ADC_CR2_DMA;
}

void
modm::platform::Adc3::disableDmaMode()
{
	ADC3->CR2 &= ~ADC_CR2_DMA;
}

bool
modm::platform::Adc3::getAdcEnabled()
{
	return (ADC3->CR2 & ADC_CR2_ADON) == ADC_CR2_ADON;
}

void
modm::platform::Adc3::enableDmaRequests()
{
	ADC3->CR2 |= ADC_CR2_DDS;
}

void
modm::platform::Adc3::disableDmaRequests()
{
	ADC3->CR2 &= ~ADC_CR2_DDS;
}

void
modm::platform::Adc3::enableScanMode()
{
	ADC3->CR1 |= ADC_CR1_SCAN;
}

void
modm::platform::Adc3::disableScanMode()
{
	ADC3->CR1 &= ~ADC_CR1_SCAN;
}