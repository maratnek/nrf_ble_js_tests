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

// const BLE_UUID_HEART_RATE_MEASUREMENT_CHAR = '2A37';
const BLE_UUID_HEART_RATE_MEASUREMENT_CHAR = '5F76E2C23737496C96CD605337DE5252';
const BLE_UUID_CCCD = '2902';

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
        adapter.writeDescriptorValue(cccdDescriptor.instanceId, [1, 0], true, err => {
            if (err) {
                this.emit('error', 'Failed to start characteristics notifications');
            }

            console.log('success sign');
            if (callback) { callback(); }
        });

    })
}

function writeInputListener(adapter, charac, value) {
    let str = value.reduce( (str, it) => str += String.fromCharCode(it));
    console.log('Write Input Listener', charac._instanceId, '  ', value);
    console.log('Write Input Listener', charac._instanceId, '  ', str);
    adapter.writeCharacteristicValue(charac.instanceId, value, false, (err, charac)=> {
        if (err) console.log(err);
        // console.log(charac.value);
    }, ()=>{console.log('DeviceNotificationFunctionTODO')});
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
                if (services[service].uuid === BLE_UUID_HEART_RATE_SERVICE) {
                    adapter.getCharacteristics(services[service].instanceId, (err, characteristics) => {
                        if (err) rej(new Error('Error'));
                        for (const iter in characteristics) {
                            let charac = characteristics[iter];
                            // console.log(charac);
                            if (charac.uuid == UUID)
                                res(charac);
                        }
                    })// getChara
                } // if service 2
            }
        });
    });
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

    /**
     * Handling the Application's BLE Stack events.
     */
    const NOTIFY_UUID = '5F76E2C23737496C96CD605337DE5252'
    const WRITE_UUID = '5F768A863737496C96CD605337DE5252'

    adapter.on('deviceConnected', device => {
        if (!device) return;
        //adapter.stopScan((err)=> console.log('Stop scan', err));
        console.log(`Device ${device.address}/${device.addressType} connected.`);

        getCharacter(device, adapter, NOTIFY_UUID).then(charac => {
            readInputListener(adapter, charac, ()=>{
                getCharacter(device, adapter, WRITE_UUID).then(charac => {
                    // console.log('Characteristic: ', charac);
                    let first = 3;
                    let num = 0;
                    let getData = (hexText) => {return String(hexText).split(' ').map(it => parseInt(it, 16));}
                    let data = getData('5f 5f 7a 6d 5f 5f 64 61 6c 69 5f 74 65 73 74 5f 5f');
                    // console.log(data.unshift(3));
//                     console.log(data);
//                     // console.log("Parse INT: ", parseInt('C1', 16));
                    // writeInputListener(adapter, charac, data);
                    // console.log(data);
//                     // 8016291122000000000000000000000000A9DEA72D010101014028050030434141740E
//                     // include
//                     let arrByTwo = (str) => {return str.match(/.{1,2}/g);}
// // let str = 'C1132F0217041DFEFF730000C1110501000900';
//    let str = 'C1132F0217041DFEFF730000C1110601000900';

// let data2 = arrByTwo(str).map(it => parseInt(it, 16));
//                     console.log(data2.unshift(17));
//                     setTimeout(()=>{
//                         // writeInputListener(adapter, charac, data2);
//                     },3000);

// // str = 'FE0173F2C8';
// str = 'FE01738700'
// let data3 = arrByTwo(str).map(it => parseInt(it, 16));
//                     console.log(data3.unshift(34));
//                     setTimeout(()=>{
//                         // writeInputListener(adapter, charac, data3);
//                     },6000);
let att_mtu = adapter.getCurrentAttMtu(device.instanceId);
console.log('Device ATT MTU size ', att_mtu);
                    let buffer = [];
                    for (let i = 0; i < (att_mtu / data.length) - 1; i++) {
                        for (let j = 0; j < data.length; j++) {
                            buffer.push( data[j] );
                        }
                    }
                    // console.log(buffer);
                    console.log(buffer.length);
                    data.unshift(3);
                    writeInputListener(adapter, charac, data);
                    // setInterval(()=>{
                    //     if (first > 240) {
                    //         first = 3;
                    //     } else if (first == 0) {
                    //         if (num == 0) {
                    //             first = 3;
                    //             num = 0;
                    //         } else num++;

                    //     } else {
                    //         first += 16;
                    //     }
                    //     data[0] = first;
                    //     writeInputListener(adapter, charac, data);
                    //     // writeInputListener(adapter, charac, [first, first, 32, 57, 34, 90, 77, 34, 57, 32]);
                    // }, 200);
                }).catch(err => console.log(err));
            });

        }).catch(err => console.log(err));


        
        // if (charac)
        // charac = getCharacter(device, adapter, WRITE_UUID);
        // if (charac)
        //     writeInputListener(adapter, charac);

        // adapter.getServices(device.instanceId, (err, services) => {
        //     if (err) return;
        //     console.log('Get Service ', device.instanceId);

        //     for (const service in services) {
        //         // console.log('service', service, services[service]);
        //         if (services[service].uuid === BLE_UUID_HEART_RATE_SERVICE) {
        //             adapter.getCharacteristics(services[service].instanceId, (err, characteristics) => {
        //                 if (err) return;
        //                 for (const iter in characteristics) {
        //                     let charac = characteristics[iter];
        //                     // console.log('characteristic', charac);
        //                     if (charac.uuid == NOTIFY_UUID) {
        //                         console.log('read charac', charac);
        //                         readInputListener(adapter, charac);
        //                     } else if (charac.uuid == WRITE_UUID) {
        //                         console.log('write char', charac)
        //                         writeInputListener(adapter, charac);
        //                     }

        //                 }
        //             })// getChara
        //         } // if service 2
        //     }
        // });
        

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

        if (device.name === 'Honeywell_UART ZM') {
        // if (device.name === 'Honeywell_U') {
        // if (device.name === 'Honeywell_UART') {
        // if (device.name === 'Nordic_UART') {
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
        // console.log('Characteristic value changed', charac.value);
        let str = charac.value.reduce((str, it) => str += String.fromCharCode(it));
        // let str = charac.value.map(it => it.toString(16));
        if (charac.uuid === BLE_UUID_HEART_RATE_MEASUREMENT_CHAR) {
            // console.log(`Received heart rate measurement: ${charac.value}.`);
            console.log(`Received heart rate measurement: ${str}.`);
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
