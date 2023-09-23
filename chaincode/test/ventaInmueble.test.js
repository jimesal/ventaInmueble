'use strict';
const sinon = require('sinon');
const chai = require('chai');
const sinonChai = require('sinon-chai');
const expect = chai.expect;

const { Context } = require('fabric-contract-api');
const { ChaincodeStub } = require('fabric-shim');

const VentaInmueble = require('../lib/ventaInmueble.js');

let assert = sinon.assert;
chai.use(sinonChai);

describe('Test Venta Inmueble', () => {
    let transactionContext, chaincodeStub, inmueble, inmuebleInit;
    beforeEach(() => {
        transactionContext = new Context();

        chaincodeStub = sinon.createStubInstance(ChaincodeStub);
        transactionContext.setChaincodeStub(chaincodeStub);

        chaincodeStub.putState.callsFake((key, value) => {
            if (!chaincodeStub.states) {
                chaincodeStub.states = {};
            }
            chaincodeStub.states[key] = value;
        });

        chaincodeStub.getState.callsFake(async (key) => {
            let ret;
            if (chaincodeStub.states) {
                ret = chaincodeStub.states[key];
            }
            return Promise.resolve(ret);
        });

        chaincodeStub.deleteState.callsFake(async (key) => {
            if (chaincodeStub.states) {
                delete chaincodeStub.states[key];
            }
            return Promise.resolve(key);
        });

        chaincodeStub.getStateByRange.callsFake(async () => {
            function* internalGetStateByRange() {
                if (chaincodeStub.states) {
                    // Shallow copy
                    const copied = Object.assign({}, chaincodeStub.states);

                    for (let key in copied) {
                        yield {value: copied[key]};
                    }
                }
            }

            return Promise.resolve(internalGetStateByRange());
        });

        inmueble = {
            catastroID: 'inmueble1',
            direccion: 'direccion1',
            constructoraCIF: 'constructora1',
            propietarioDNI: null,
            ultimoPrecio: null,
        };

        inmuebleInit = {
            catastroID: 'I00000',
            direccion: 'Av de la Paloma 81, 7B, 28021, Madrid, Espana',
            constructoraCIF: 'C00000',
            propietarioDNI: '00000D',
            ultimoPrecio: 603000,
        };
    });

    describe('Test InitLedger', () => {
        it('should return error on InitLedger', async () => {
            chaincodeStub.putState.rejects('failed inserting key');
            let ventaInmueble = new VentaInmueble();
            try {
                await ventaInmueble.InitLedger(transactionContext);
                assert.fail('InitLedger should have failed');
            } catch (err) {
                expect(err.name).to.equal('failed inserting key');
            }
        });

        it('should return success on InitLedger', async () => {
            let ventaInmueble = new VentaInmueble();
            await ventaInmueble.InitLedger(transactionContext);
            let ret = JSON.parse((await chaincodeStub.getState('I00000')).toString());
            expect(ret).to.eql(Object.assign({docType: 'inmueble'}, inmuebleInit));
        });
    });

    describe('Test CreateAsset', () => {
        it('should return error on CreateAsset', async () => {
            chaincodeStub.putState.rejects('failed inserting key');

            let ventaInmueble = new VentaInmueble();
            try {
                await ventaInmueble.RegistrarInmueble(transactionContext, inmueble.catastroID, inmueble.direccion, inmueble.constructoraCIF);
                assert.fail('RegistrarInmueble should have failed');
            } catch(err) {
                expect(err.name).to.equal('failed inserting key');
            }
        });

        it('should return success on RegistrarInmueble', async () => {
            let ventaInmueble = new VentaInmueble();

            await ventaInmueble.RegistrarInmueble(transactionContext, inmueble.catastroID, inmueble.direccion, inmueble.constructoraCIF);

            let ret = JSON.parse((await chaincodeStub.getState(inmueble.catastroID)).toString());
            expect(ret).to.eql(inmueble);
        });
    });

    describe('Test LeerInmueble', () => {
        it('should return error on LeerInmueble', async () => {
            let ventaInmueble = new VentaInmueble();
            await ventaInmueble.RegistrarInmueble(transactionContext, inmueble.catastroID, inmueble.direccion, inmueble.constructoraCIF);

            try {
                await ventaInmueble.LeerInmueble(transactionContext, 'inmueble2');
                assert.fail('LeerInmueble should have failed');
            } catch (err) {
                expect(err.message).to.equal('El inmueble inmueble2 no existe');
            }
        });

        it('should return success on ReadAsset', async () => {
            let ventaInmueble = new VentaInmueble();
            await ventaInmueble.RegistrarInmueble(transactionContext, inmueble.catastroID, inmueble.direccion, inmueble.constructoraCIF);

            let ret = JSON.parse(await chaincodeStub.getState(inmueble.catastroID));
            expect(ret).to.eql(inmueble);
        });
    });

    describe('Test VenderInmueble', () => {
        it('should return error on TransferAsset', async () => {
            let ventaInmueble = new VentaInmueble();
            await ventaInmueble.RegistrarInmueble(transactionContext, inmueble.catastroID, inmueble.direccion, inmueble.constructoraCIF);

            try {
                await ventaInmueble.VenderInmueble(transactionContext, 'inmueble2', 'Me', 10);
                assert.fail('VenderInmueble should have failed');
            } catch (err) {
                expect(err.message).to.equal('El inmueble inmueble2 no existe');
            }
        });

        it('should return success on VenderInmueble', async () => {
            let ventaInmueble = new VentaInmueble();
            await ventaInmueble.RegistrarInmueble(transactionContext, inmueble.catastroID, inmueble.direccion, inmueble.constructoraCIF);

            await ventaInmueble.VenderInmueble(transactionContext, inmueble.catastroID, 'Me', 10);
            let ret = JSON.parse((await chaincodeStub.getState(inmueble.catastroID)).toString());
            expect(ret).to.eql(Object.assign({}, inmueble, {propietarioDNI: 'Me', ultimoPrecio: 10}));
        });
    });

    describe('Test GetTodosInmuebles', () => {
        it('should return success on GetTodosInmuebles', async () => {
            let ventaInmueble = new VentaInmueble();

            await ventaInmueble.RegistrarInmueble(transactionContext, 'inmueble2', 'direccion2', 'constructora2');
            await ventaInmueble.RegistrarInmueble(transactionContext, 'inmueble3', 'direccion3', 'constructora3');
            await ventaInmueble.RegistrarInmueble(transactionContext, 'inmueble4', 'direccion4', 'constructora4');
            await ventaInmueble.RegistrarInmueble(transactionContext, 'inmueble5', 'direccion5', 'constructora5');

            let ret = await ventaInmueble.GetTodosInmuebles(transactionContext);
            ret = JSON.parse(ret);
            expect(ret.length).to.equal(4);

            let expected = [
                {catastroID: 'inmueble2', direccion: 'direccion2', constructoraCIF: 'constructora2', propietarioDNI:null, ultimoPrecio: null},
                {catastroID: 'inmueble3', direccion: 'direccion3', constructoraCIF: 'constructora3', propietarioDNI:null, ultimoPrecio: null},
                {catastroID: 'inmueble4', direccion: 'direccion4', constructoraCIF: 'constructora4', propietarioDNI:null, ultimoPrecio: null},
                {catastroID: 'inmueble5', direccion: 'direccion5', constructoraCIF: 'constructora5', propietarioDNI:null, ultimoPrecio: null},
            ];

            expect(ret).to.eql(expected);
        });

        it('should return success on GetAllAssets for non JSON value', async () => {
            let ventaInmueble = new VentaInmueble();

            chaincodeStub.putState.onFirstCall().callsFake((key, value) => {
                if (!chaincodeStub.states) {
                    chaincodeStub.states = {};
                }
                chaincodeStub.states[key] = 'non-json-value';
            });

            await ventaInmueble.RegistrarInmueble(transactionContext, 'inmueble1', 'direccion1', 'constructora1');
            await ventaInmueble.RegistrarInmueble(transactionContext, 'inmueble2', 'direccion2', 'constructora2');
            await ventaInmueble.RegistrarInmueble(transactionContext, 'inmueble3', 'direccion3', 'constructora3');
            await ventaInmueble.RegistrarInmueble(transactionContext, 'inmueble4', 'direccion4', 'constructora4');

            let ret = await ventaInmueble.GetTodosInmuebles(transactionContext);
            ret = JSON.parse(ret);
            expect(ret.length).to.equal(4);

            let expected = [
                'non-json-value',
                {catastroID: 'inmueble2', direccion: 'direccion2', constructoraCIF: 'constructora2', propietarioDNI: null, ultimoPrecio: null},
                {catastroID: 'inmueble3', direccion: 'direccion3', constructoraCIF: 'constructora3', propietarioDNI: null, ultimoPrecio: null},
                {catastroID: 'inmueble4', direccion: 'direccion4', constructoraCIF: 'constructora4', propietarioDNI: null, ultimoPrecio: null},
            ];

            expect(ret).to.eql(expected);
        });
    });
});
