/* Copyright (c) 2010 - 2017, Nordic Semiconductor ASA
 *
 * All rights reserved.
 *
 * Use in source and binary forms, redistribution in binary form only, with
 * or without modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions in binary form, except as embedded into a Nordic
 *    Semiconductor ASA integrated circuit in a product or a software update for
 *    such product, must reproduce the above copyright notice, this list of
 *    conditions and the following disclaimer in the documentation and/or other
 *    materials provided with the distribution.
 *
 * 2. Neither the name of Nordic Semiconductor ASA nor the names of its
 *    contributors may be used to endorse or promote products derived from this
 *    software without specific prior written permission.
 *
 * 3. This software, with or without modification, must only be used with a Nordic
 *    Semiconductor ASA integrated circuit.
 *
 * 4. Any software provided in binary form under this license must not be reverse
 *    engineered, decompiled, modified and/or disassembled.
 *
 * THIS SOFTWARE IS PROVIDED BY NORDIC SEMICONDUCTOR ASA "AS IS" AND ANY EXPRESS OR
 * IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY, NONINFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL NORDIC SEMICONDUCTOR ASA OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
 * TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/** @example examples/heart_rate_collector
 *
 * @brief Heart Rate Collector Sample Application main file.
 *
 * This file contains the source code for a sample application that acts as a BLE Central device.
 * This application scans for a Heart Rate Sensor device and reads it's heart rate data.
 * https://www.bluetooth.com/specifications/gatt/viewer?attributeXmlFile=org.bluetooth.service.heart_rate.xml
 */

'use strict';

const api = require('../index');
const path = require('path');

const adapterFactory = api.AdapterFactory.getInstance(undefined, { enablePolling: false });

// const BLE_UUID_HEART_RATE_SERVICE = '180D';
const BLE_UUID_HEART_RATE_SERVICE = '5F7600013737496C96CD605337DE5252';
//const BLE_UUID_HEART_RATE_SERVICE = '6E400001B5A3F393E0A9E50E24DCCA9E';

// const BLE_UUID_HEART_RATE_MEASUREMENT_CHAR = '2A37';
const BLE_UUID_HEART_RATE_MEASUREMENT_CHAR = '5F76E2C23737496C96CD605337DE5252';
//const BLE_UUID_HEART_RATE_MEASUREMENT_CHAR = '6E400003B5A3F393E0A9E50E24DCCA9E';
const BLE_UUID_CCCD = '1801';

/**
 * Discovers the heart rate service in the BLE peripheral's GATT attribute table.
 *
 * @param {Adapter} adapter Adapter being used.
 * @param {Device} device Bluetooth central device being used.
 * @returns {Promise} Resolves on successfully discovering the heart rate service.
 *                    If an error occurs, rejects with the corresponding error.
 */
function discoverHeartRateService(adapter, device) {
    console.log(device);
    return new Promise((resolve, reject) => {
        adapter.getServices(device.instanceId, (err, services) => {
            if (err) {
                reject(Error(`Error discovering the heart rate service: ${err}.`));
                return;
            }

            for (const service in services) {
                console.log('service',service, services[service]);
                if (services[service].uuid === BLE_UUID_HEART_RATE_SERVICE) {
                    resolve(services[service]);
                    return;
                }
            }

            reject(Error('Did not discover the heart rate service in peripheral\'s GATT attribute table.'));
        });
    });
}

/**
 * Discovers the heart rate measurement characteristic in the BLE peripheral's GATT attribute table.
 *
 * @param {Adapter} adapter Adapter being used.
 * @param {Service} heartRateService The heart rate service to discover characteristics from
 * @returns {Promise} Resolves on successfully discovering the heart rate measurement characteristic.
 *                    If an error occurs, rejects with the corresponding error.
 */
function discoverHRMCharacteristic(adapter, heartRateService) {
    return new Promise((resolve, reject) => {
        adapter.getCharacteristics(heartRateService.instanceId, (err, characteristics) => {
            if (err) {
                reject(Error(`Error discovering the heart rate service's characteristics: ${err}.`));
                return;
            }

            // eslint-disable-next-line guard-for-in
            for (const characteristic in characteristics) {
                console.log('characteristic: ', characteristic, characteristics[characteristic]);
                if (characteristics[characteristic].uuid === BLE_UUID_HEART_RATE_MEASUREMENT_CHAR) {
                    resolve(characteristics[characteristic]);
                    return;
                }
            }

            reject(Error('Did not discover the heart rate measurement chars in peripheral\'s GATT attribute table.'));
        });
    });
}

/**
 * Discovers the heart rate measurement characteristic's CCCD in the BLE peripheral's GATT attribute table.
 *
 * @param {Adapter} adapter Adapter being used.
 * @param {Characteristic} heartRateMeasurementCharacteristic The characteristic to discover CCCD from.
 * @returns {Promise} Resolves on successfully discovering the heart rate measurement characteristic's CCCD.
 *                    If an error occurs, rejects with the corresponding error.
 */
function discoverHRMCharCCCD(adapter, heartRateMeasurementCharacteristic) {
    return new Promise((resolve, reject) => {
        adapter.getDescriptors(heartRateMeasurementCharacteristic.instanceId, (err, descriptors) => {
            if (err) {
                reject(Error(`Error discovering the heart rate characteristic's CCCD: ${err}.`));
                return;
            }

            for (const descriptor in descriptors) {
                console.log('descriptor', descriptor, descriptors[descriptor]);
                if (descriptors[descriptor].uuid === BLE_UUID_CCCD) {
                    resolve(descriptors[descriptor]);
                    return;
                }
            }

            reject(Error('Did not discover the hrm chars CCCD in peripheral\'s GATT attribute table.'));
        });
    });
}

/**
 * Allow user to toggle notifications on the hrm char with a key press, as well as cleanly exiting the application.
 *
 * @param {Adapter} adapter Adapter being used.
 * @param {Descriptor} cccdDescriptor The descriptor for enabling/disabling enable/disable notifications.
 * @returns {undefined}
 */
function addUserInputListener(adapter, cccdDescriptor) {
    process.stdin.setEncoding('utf8');
    //process.stdin.setRawMode(true);

    const notificationsEnabled = [0, 0];

    process.stdin.on('readable', () => {
        const chunk = process.stdin.read();
        if (chunk === null) return;

        if (chunk[0] === 'q' || chunk[0] === 'Q') {
            adapter.close(err => {
                if (err) {
                    console.log(`Error closing the adapter: ${err}.`);
                }

                console.log('Exiting the application...');
                process.exit(1);
            });
        } else {
            if (notificationsEnabled[0]) {
                notificationsEnabled[0] = 0;
                console.log('Disabling notifications on the heart rate measurement characteristic.');
            } else {
                notificationsEnabled[0] = 1;
                console.log('Enabling notifications on the heart rate measurement characteristic.');
            }

            adapter.writeDescriptorValue(cccdDescriptor.instanceId, notificationsEnabled, false, err => {
                if (err) {
                    console.log(`Error enabling notifications on the hrm characteristic: ${err}.`);
                    process.exit(1);
                }

                console.log('Notifications toggled on the heart rate measurement characteristic.');
            });
        }
    });
}

function readInputListener(adapter, charac, callback) {
    console.log('Read Input Listener', charac._instanceId);
    adapter.getDescriptors(charac.instanceId, (err, descs)=> {
        if (err) return;
        let cccdDescriptor = descs[0];
        console.log(cccdDescriptor);
        adapter.writeDescriptorValue(cccdDescriptor.instanceId, [1, 0], true, err => {
            if (err) {
                this.emit('error', 'Failed to start characteristics notifications');
            }

            console.log('success sign');
            if (callback) { callback(); }
        });

    })
}

let Input = true;

function writeInputListener(adapter, charac, value) {
    //let str = value.reduce( (str, it) => str += String.fromCharCode(it));
    // console.log('Write Input Listener', charac._instanceId, '  ', value);
    const device = adapter._getDeviceByCharacteristicId(charac._instanceId);
    console.log('Write Input Listener', charac._instanceId, '  ', value.map(it => it.toString(16)));
    if (!adapter._gattOperationsMap[device.instanceId]) {
        adapter.writeCharacteristicValue(charac.instanceId, value, false, (err, charac) => {
            if (err) 
            {
                console.log('Write characteristic value: ', err);
                Input = false;
            }
            else
              Input = true;
            // console.log(charac.value);
        }, () => { console.log('DeviceNotificationFunctionTODO') });
    }

}

/**
 * Connects to the desired BLE peripheral.
 *
 * @param {Adapter} adapter Adapter being used.
 * @param {any} connectToAddress Device address of the advertising BLE peripheral to connect to.
 * @returns {Promise} Resolves on successfully connecting to the BLE peripheral.
 *                    If an error occurs, rejects with the corresponding error.
 */
function connect(adapter, connectToAddress) {
    return new Promise((resolve, reject) => {
        console.log(`Connecting to device ${connectToAddress}...`);

        const options = {
            scanParams: {
                // active: false,
                active: true,
                interval: 100,
                window: 50,
                timeout: 5,
            },
            connParams: {
                min_conn_interval: 7.5,
                max_conn_interval: 7.5,
                slave_latency: 0,
                conn_sup_timeout: 4000,
            },
        };

        adapter.connect(connectToAddress, options, err => {
            if (err) {
                reject(Error(`Error connecting to target device: ${err}.`));
                return;
            }

            resolve();
        });
    });
}

/**
 * Function to start scanning (GAP Discovery procedure, Observer Procedure).
 *
 * @param {Adapter} adapter Adapter being used.
 * @returns {Promise} Resolves on successfully initiating the scanning procedure.
 *                    If an error occurs, rejects with the corresponding error.
 */
function startScan(adapter) {
    return new Promise((resolve, reject) => {
        console.log('Started scanning...');

        const scanParameters = {
            active: true,
            interval: 100,
            window: 50,
            timeout: 0,
        };

        adapter.startScan(scanParameters, err => {
            if (err) {
                reject(new Error(`Error starting scanning: ${err}.`));
            } else {
                resolve();
            }
        });
    });
}

function getCharacter(device, adapter, UUID) {
    return new Promise((res,rej)=>{
        adapter.getServices(device.instanceId, (err, services) => {
            if (err) rej(new Error('Error'));
            console.log('Get Service ', device.instanceId);
            for (const service in services) {
                console.log(services[service].uuid);
                if (services[service].uuid === BLE_UUID_HEART_RATE_SERVICE) {
                    adapter.getCharacteristics(services[service].instanceId, (err, characteristics) => {
                        if (err) rej(new Error('Error'));
                        for (const iter in characteristics) {
                            let charac = characteristics[iter];
                            console.log(charac);
                            if (charac.uuid == UUID)
                                res(charac);
                        }
                    })// getChara
                } // if service 2
            }
        });
    });
}

//uint16_t crc16Table[256];
let crc16Table = new Uint16Array(256);
let arr = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

function CRC16Init()
{
  let POLY = 0x1021;
  let  ix;

  for (ix = 0; ix < 256; ix++)
  {
    let crc = ix << 8;
    for (let i=0; i<8; i++)                           /* Prepare to rotate 8 bits */
    {
      crc <<= 1;
      if (crc & 0x10000) crc ^= (POLY | 0x10000);       /* XOR with XMODEM polynomic and ensure CRC remains 16-bit value */
    }
    crc16Table[ix] = crc;
  }
}

function CRC16(u8Ptr, u16Length, crc)
{
  for (let b of u8Ptr)
  {
    var ix = ((crc >> 8) ^ b) & 0xff;
    crc = (crc16Table[ix] ^ (crc << 8)) & 0x0ffff;
  }
  return crc; /* Return updated CRC */
}

CRC16Init();

function getCRC16Array(arr, ceed) {
    if (!ceed)
        ceed = 0;
    let crc = CRC16(arr, arr.length, ceed)
    return [(crc & 0xff), (crc >> 8)];
}

/**
 * Handling events emitted by adapter.
 *
 * @param {Adapter} adapter Adapter in use.
 * @returns {void}
 */
function addAdapterListener(adapter) {
    /**
     * Handling error and log message events from the adapter.
     */
    adapter.on('logMessage', (severity, message) => { if (severity > 3) console.log(`${message}.`); });
    adapter.on('error', error => { console.log(`error: ${JSON.stringify(error, null, 1)}.`); });
    adapter.on('status', status => { console.log(`status: ${JSON.stringify(status, null, 1)}.`); });

    let XON = true;
    /**
     * Handling the Application's BLE Stack events.
     */
    const NOTIFY_UUID = '5F76E2C23737496C96CD605337DE5252'
    const WRITE_UUID = '5F768A863737496C96CD605337DE5252'
    
    adapter.on('deviceConnected', device => {
        if (!device) return;
        //adapter.stopScan((err)=> console.log('Stop scan', err));
        console.log(`Device ${device.address}/${device.addressType} connected. ${JSON.stringify(device)}`);

        getCharacter(device, adapter, NOTIFY_UUID).then(charac => {
            readInputListener(adapter, charac, ()=>{
                getCharacter(device, adapter, WRITE_UUID).then(charac => {
                    console.log('Characteristic: ', charac);
                    let getData = (hexText) => {return String(hexText).split(' ').map(it => parseInt(it, 16));}
                    let first = 3;
                    let num = 0;
                    let getFirst = () => {
                        if (first > 240) {
                            first = 3;
                        } else if (first == 0) {
                            if (num == 0) {
                                first = 3;
                                num = 0;
                            } else num++;

                        } else {
                            first += 16;
                        }
                        return first;
                    }
                    // offset
                    let getOffset = (iter, offset) => {
                        if (!offset)
                            offset = 0x80;
                        function uInt32ToLEByteArray(n) {
                            var byteArray = new Uint8Array(4);
                            for (var i = 0; i < 4; i++) {
                                byteArray[i] = n & 255;
                                n >>>= 8; //simply doing n >> 8 has no effect actually
                            }
                            var arr = [];
                            for (let it of byteArray)
                                arr.push(it);
                            return arr;
                        }
                        //console.log(iter*offset);
                        return uInt32ToLEByteArray(iter*offset);
                    }
                    // data
                    let getRandData = (size) => {
                        let arr = [];
                        for (let i = 0; i < size; i++) {
                            arr.push(Math.floor(Math.random() * 255));                          
                        }
                        return arr;
                    }
                    const header = '13 29 03';
                    let packet_size = 128;
                    
                    let iter = 0;
                    const it_count = 2000;
                    let ble_interval = setInterval(()=>{
                        if (XON && Input) {
                            Input = false;
                            console.log('Iteration', iter);
                            let data = getData(header);
                            data.push(packet_size + 10);
                            data = data.concat(getOffset(iter++));
                            data = data.concat(getRandData(packet_size));
                            let ceed = 0x824C;
                            data = data.concat(getCRC16Array(data, ceed));
                            data.unshift(0xC1);
                            data.unshift(0x80);
                            data[0] = getFirst();
                            //console.log('Data', data);
                            writeInputListener(adapter, charac, data);
                            if (iter == it_count) {
                                clearInterval(ble_interval);
                                data = getData('80 C1 13 29 02 06 29 32');
                                console.log('reset and load new fw')
                                data[0] = getFirst();
                                writeInputListener(adapter, charac, data);
                            }
                        } else if (!XON) {
                            console.log('XOFF');
                        } else {

                        }
                        
                    }, 20);


                    // buffer = data;
                    
                    //writeInputListener(adapter, charac, data);
                    //80 C1 13 29 03 0xd85b
                    
                    // data = getData('80 C1');
                    // //let crc_data = getData('13 29 03 8A 00 00 00 00 40 8C ED 99 49 81 E6 89 97 85 1D FE 97 95 6E 12 3D 59 32 5C CF 27 8B AC 87 B8 32 1D 7A 5C 11 73 99 67 A0 FC C9 00 6E 0C 45 63 D7 1A 88 D8 D8 E2 79 1F 4F AB 19 89 63 0F 00 15 7D 98 B4 F1 12 DF 47 B3 70 9E E8 E9 07 0B 96 C7 65 E5 24 9D D9 30 C6 F9 0A D5 AF E4 73 38 26 25 58 EC 7F 34 DC 79 65 B0 62 52 16 B5 12 54 EA 6C EB 48 3F B7 0D 77 89 38 72 37 DC 75 0D 98 51 29 FC 34 15 34 89 BD');
                    // let crc_data = getData('13 29 03');
                    // console.log('crc_data size', crc_data.length);
                    // crc_arr = getCRC16Array(crc_data, ceed);
                    // let finish_data = data.concat(crc_data, crc_arr);
                    // console.log('crc_arr', crc_arr);
                    // console.log(crc_arr[0].toString(16));
                    // console.log(crc_arr[1].toString(16));
                    // let it_count = 10;
                    // let ble_interval = setInterval(()=>{
                    //     finish_data[0] = getFirst();
                    //     writeInputListener(adapter, charac, finish_data);
                    //     console.log('iteration ', it_count);
                    //     if (!(it_count--))
                    //     {
                    //         clearInterval(ble_interval);
                    //         data = getData('80 C1 13 29 02 06 29 32');
                    //         console.log('reset and load new fw')
                    //         data[0] = getFirst();
                    //         writeInputListener(adapter, charac, data);
                    //     }
                    // }, 45);
                    
                }).catch(err => console.log(err));
            });

        }).catch(err => console.log(err));

    });

    adapter.on('deviceDisconnected', device => {
        console.log(`Device ${device.address} disconnected.`);

        // startScan(adapter).then(() => {
        //     console.log('Successfully initiated the scanning procedure.');
        // }).catch(error => {
        //     console.log(error);
        // });
        process.exit(1);
    });

    adapter.on('deviceDiscovered', device => {
        console.log(`Discovered device ${device.address}/${device.name}/.`);

        if (device.name === 'SYLK SENSOR 979e') {
            connect(adapter, device.address).then(() => {
                // no need to do anything here
                // adapter.emit('scanTimedOut');
                adapter.emit('deviceConnected');
            }).catch(error => {
                console.log(error);
                process.exit(1);
            });
        }
    });

    adapter.on('scanTimedOut', () => {
        console.log('scanTimedOut: Scanning timed-out. Exiting.');
        process.exit(1);
    });

    adapter.on('characteristicValueChanged', charac => {
        // console.log('Characteristic value changed', charac.uuid, charac.value);
        // let str = charac.value.reduce((str, it) => str += String.fromCharCode(it));
        let str = charac.value.map(it => it.toString(16));
        if (charac.uuid === BLE_UUID_HEART_RATE_MEASUREMENT_CHAR) {
            // console.log(`Received heart rate measurement: ${charac.value}.`);
            console.log(`Received heart rate measurement: ${str}.`);
            if (str[1] == 0x13) {
                XON = false;
                console.log("XON false");
            } else if (str[1] == 0x11) {
                XON = true;
                console.log("XON true");
            } else {
            }
        }
    });
    adapter.on('characteristicAdded', attribute => {
        console.log('Characteristic added');
    });

    adapter.on('deviceNotifiedOrIndicated', (remoteD, charac) => {
        console.log('Notify deviceNotifiedOrIndicated');
    });
}

/**
 * Opens adapter for use with the default options.
 *
 * @param {Adapter} adapter Adapter to be opened.
 * @returns {Promise} Resolves if the adapter is opened successfully.
 *                    If an error occurs, rejects with the corresponding error.
 */
function openAdapter(adapter) {
    return new Promise((resolve, reject) => {
        const baudRate = process.platform === 'darwin' ? 115200 : 1000000;
        console.log(`Opening adapter with ID: ${adapter.instanceId} and baud rate: ${baudRate}...`);

        adapter.open({ baudRate, logLevel: 'debug' }, err => {
            if (err) {
                reject(Error(`Error opening adapter: ${err}.`));
            }

            resolve();
        });
    });
}

function help() {
    console.log(`Usage: ${path.basename(__filename)} <PORT> <SD_API_VERSION>`);
    console.log();
    console.log('PORT is the UART for the adapter. For example /dev/ttyS0 on Unix based systems or COM1 on Windows based systems.');
    console.log('SD_API_VERSION can be v2 or v3. nRF51 series uses v2.');
    console.log();
    console.log('It is assumed that the nRF device has been programmed with the correct connectivity firmware.');
}

/**
 * Application main entry.
 */
if (process.argv.length !== 4) {
    help();
    process.exit(-1);
} else {
    const [,, port, apiVersion] = process.argv;

    if (port == null) {
        console.error('PORT must be specified');
        process.exit(-1);
    }

    if (apiVersion == null) {
        console.error('SD_API_VERSION must be provided');
        process.exit(-1);
    } else if (!['v2', 'v3'].includes(apiVersion)) {
        console.error(`SD_API_VERSION must be v2 or v3, argument provided is ${apiVersion}`);
        process.exit(-1);
    }

    const adapter = adapterFactory.createAdapter(apiVersion, port, '');
    addAdapterListener(adapter);

    openAdapter(adapter).then(() => {
        console.log('Opened adapter.');
        return startScan(adapter);
    }).then(() => {
        console.log('Scanning.');
    }).catch(error => {
        console.log(error);
        process.exit(-1);
    });
}
