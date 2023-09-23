/*
 * Copyright IBM Corp. All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict';

// Deterministic JSON.stringify()
const stringify = require('json-stringify-deterministic');
const sortKeysRecursive = require('sort-keys-recursive');
const { Contract } = require('fabric-contract-api');

class VentaInmueble extends Contract {
    async InitLedger(ctx) {
        const inmuebles = [
            {
                catastroID: 'I00000',
                direccion: 'Av de la Paloma 81, 7B, 28021, Madrid, Espana',
                constructoraCIF: 'C00000',
                propietarioDNI: '00000D',
                ultimoPrecio: 603000,
            },
            {
                catastroID: 'I00001',
                direccion: 'c/ Cienpies 23, 2A, 32021, Toledo, Espana',
                constructoraCIF: 'C00001',
                propietarioDNI: '10000D',
                ultimoPrecio: 125000,
            },
            {
                catastroID: 'I00002',
                direccion: 'c/ Cava Alta 2, 45333, Alicante, Espana',
                constructoraCIF: 'C00002',
                propietarioDNI: 'Mercedes Jimenez Etxevarria',
                ultimoPrecio: 230000,
            },
            {
                catastroID: 'I00003',
                direccion: 'c/ Santa Clara 76, 4D, 12300, Zaragoza, Espana',
                constructoraCIF: 'C00003',
                propietarioDNI: '30000D',
                ultimoPrecio: 332000,
            },
            {
                catastroID: 'I00004',
                direccion: 'Av de la Constitucion 40, 7F, 18006, Almeria, Espana',
                constructoraCIF: 'C00004',
                propietarioDNI: '40000D',
                ultimoPrecio: null,
            },
            {
                catastroID: 'I00005',
                direccion: 'c/ Borrell 17, 8A, 22090, Tarragona, Espana',
                constructoraCIF: 'C00005',
                propietarioDNI: '50000D',
                ultimoPrecio: 298000,
            },
        ];

        for (const inmueble of inmuebles) {
            inmueble.docType = 'inmueble';
            // example of how to write to world state deterministically
            // use convetion of alphabetic order
            // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
            // when retrieving data, in any lang, the order of data will be the same and consequently also the corresonding hash
            await ctx.stub.putState(
                inmueble.catastroID,
                Buffer.from(stringify(sortKeysRecursive(inmueble)))
            );
        }
    }

    // RegistrarInmueble issues a new asset inmueble to the world state with given details.
    async RegistrarInmueble(
        ctx,
        _catastroID,
        _direccion,
        _constructoraCIF) {
        const existe = await this.ExisteInmueble(ctx, _catastroID);
        if (existe) {
            throw new Error(`El inmueble ${_catastroID} ya existe`);
        }

        const inmueble = {
            catastroID: _catastroID,
            direccion: _direccion,
            constructoraCIF: _constructoraCIF,
            propietarioDNI: null,
            ultimoPrecio: null,
        };
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(
            _catastroID,
            Buffer.from(stringify(sortKeysRecursive(inmueble)))
        );
        return JSON.stringify(inmueble);
    }

    // LeerInmueble returns the asset stored in the world state with given id.
    async LeerInmueble(ctx, catastroID) {
        const inmuebleJSON = await ctx.stub.getState(catastroID); // get the asset from chaincode state
        if (!inmuebleJSON || inmuebleJSON.length === 0) {
            throw new Error(`El inmueble ${catastroID} no existe`);
        }
        return inmuebleJSON.toString();
    }

    // ExisteInmueble returns true when asset with given ID exists in world state.
    async ExisteInmueble(ctx, catastroID) {
        const inmuebleJSON = await ctx.stub.getState(catastroID);
        return inmuebleJSON && inmuebleJSON.length > 0;
    }

    // VenderInmueble updates the owner field and price (depending on the sale transaction) of inmueble with given id in the world state.
    async VenderInmueble(ctx, catastroID, nuevoPropietarioDNI, precio) {
        const inmuebleString = await this.LeerInmueble(ctx, catastroID);
        const inmueble = JSON.parse(inmuebleString);
        const antiguoPropietario = inmueble.propietarioDNI;
        inmueble.propietarioDNI = nuevoPropietarioDNI;
        inmueble.ultimoPrecio = precio;
        // we insert data in alphabetic order using 'json-stringify-deterministic' and 'sort-keys-recursive'
        await ctx.stub.putState(
            catastroID,
            Buffer.from(stringify(sortKeysRecursive(inmueble)))
        );
        return antiguoPropietario;
    }

    // GetTodosInmuebles returns all assets found in the world state.
    async GetTodosInmuebles(ctx) {
        const inmuebles = [];
        // range query with empty string for startKey and endKey does an open-ended query of all assets in the chaincode namespace.
        const iterator = await ctx.stub.getStateByRange('', '');
        let inmueble = await iterator.next();
        while (!inmueble.done) {
            const strValue = Buffer.from(inmueble.value.value.toString()).toString(
                'utf8'
            );
            let record;
            try {
                record = JSON.parse(strValue);
            } catch (err) {
                console.log(err);
                record = strValue;
            }
            inmuebles.push(record);
            inmueble = await iterator.next();
        }
        return JSON.stringify(inmuebles);
    }
}

module.exports = VentaInmueble;
