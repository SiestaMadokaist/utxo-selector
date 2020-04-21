import * as bitcoin from 'bitcoinjs-lib';
import { expect } from 'chai';
import $debug from 'debug';
import utils from 'util';
import { P2WPKHCalculator, P2MSCalculator } from '.';
import { BD } from './modules/BigDecimal';
import { UTXO } from './types';
import { p } from './modules/AbstractSelector';
import { ValidationException } from './helper/errors';
Buffer.prototype[utils.inspect.custom as any] = function(this: Buffer): string {
  return `Buffer: ${this.toString('hex')}`;
} as any;
// tslint:disable-next-line:no-var-requires
const debug = require('debug')('utxo-selector:debug:playground');
// tslint:disable-next-line:no-var-requires
const log = require('debug')('utxo-selector:log:playground');
// const debug = (...args: any[]) => {};
const NETWORK = bitcoin.networks.regtest;
// const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const randomHex = () => Math.floor(Math.random() * 16).toString(16);
const sampleTxid = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const seed = Buffer.from('5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4', 'hex');
const root = bitcoin.bip32.fromSeed(seed, NETWORK);
const master = root.derivePath(`m/49'/0'/0'`);

function createNonWitnessUTXO(address: string, value: number, outputCount: number = 1): { nonWitnessUtxo: UTXO.NonWitnessUTXO, hash: Buffer } {
  const prevPsbt = new bitcoin.Psbt({ network: NETWORK });
  const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: master.publicKey, network: NETWORK });
  prevPsbt.addInput({
    index: 0,
    hash: sampleTxid.replace(/\w/g, () => randomHex()),
    witnessUtxo: {
      script: p2wpkh.output as Buffer,
      value: value + 500,
    },
  });
  for (let i = 0; i < outputCount; i++) {
    prevPsbt.addOutput({
      address: address as string,
      value,
    });
  }
  prevPsbt.signAllInputs(master);
  const validated = prevPsbt.validateSignaturesOfAllInputs();
  if (!validated) { throw new ValidationException(`signature doesnt match`); }
  prevPsbt.finalizeAllInputs();
  const tx = prevPsbt.extractTransaction();
  return { nonWitnessUtxo: tx.toBuffer(), hash: tx.getHash() };
}

describe('p2sh-p2wsh-p2ms', () => {
  it('can be signed', () => {
    const m = 4;
    const inputCount = 40;
    const pubkeys = [...new Array(m)].map((_, i) => master.derive(i).publicKey);
    debug({ pubkeys, m, });
    const p2ms = bitcoin.payments.p2ms({ pubkeys, m, network: NETWORK });
    const p2wsh = bitcoin.payments.p2wsh({ redeem: p2ms, network: NETWORK });
    const p2sh = bitcoin.payments.p2sh({ redeem: p2wsh, network: NETWORK });
    const inputs: UTXO.WitnessInput[] = [ ...new Array(inputCount)].map((x) => ({
      index: 0,
      hash: sampleTxid.replace(/\w/g, () => randomHex()),
      witnessUtxo: {
        script: p(p2sh.output as Buffer),
        value: 1000,
      },
      witnessScript: p2sh.redeem?.redeem?.output,
      redeemScript: p2sh.redeem?.output,
    }));
    const Selector = P2MSCalculator['P2SH-P2WSH'](m);
    const selector = new Selector({
      inputs,
      outputs: [
        { address: p(p2sh.address as string), value: p(2100) }
      ],
      changeAddress: p(p2sh.address as string),
      feeRate: 1,
    });
    const psbt = selector.psbt({ network: bitcoin.networks.regtest });
    for (let i = 0; i < m; i++) { psbt.signAllInputs(master.derive(i)); }
    const validated = psbt.validateSignaturesOfAllInputs();
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    expect(validated).to.eq(true);
    debug({ vsize: tx.virtualSize(), fee: psbt.getFee(), l: tx.toBuffer().length });
    expect(tx.virtualSize()).to.be.lessThan(psbt.getFee());
  });
});

describe('p2sh-p2ms', () => {
  it('can be signed', () => {
    const m = 4;
    const inputCount = 40;
    const pubkeys = [...new Array(m)].map((_, i) => master.derive(i).publicKey);
    debug({ pubkeys, m, });
    const p2ms = bitcoin.payments.p2ms({ pubkeys, m, network: NETWORK });
    const p2wsh = bitcoin.payments.p2wsh({ redeem: p2ms, network: NETWORK });
    const p2sh = bitcoin.payments.p2sh({ redeem: p2ms, network: NETWORK });
    const inputs: UTXO.NonWitnessInput[] = [ ...new Array(inputCount)].map((x) => ({
      index: 0,
      ...createNonWitnessUTXO(p2sh.address as string, 10000),
      // witnessScript: p2sh.redeem?.redeem?.output,
      redeemScript: p2sh.redeem?.output,
    }));
    const Selector = P2MSCalculator.P2SH(m);
    const selector = new Selector({
      inputs,
      outputs: [
        { address: p(p2wsh.address as string), value: p(21000) }
      ],
      changeAddress: p(p2sh.address as string),
      feeRate: 1,
    });
    const psbt = selector.psbt({ network: bitcoin.networks.regtest });
    for (let i = 0; i < m; i++) { psbt.signAllInputs(master.derive(i)); }
    const validated = psbt.validateSignaturesOfAllInputs();
    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();
    const iCount = tx.ins.length;
    const oCount = tx.outs.length;
    expect(validated).to.eq(true);
    debug({ vsize: tx.virtualSize(), fee: psbt.getFee(), l: tx.toBuffer().length, iCount, oCount });
    expect(tx.virtualSize()).to.be.lessThan(psbt.getFee());
    const dests = tx.outs.map((t) => bitcoin.address.fromOutputScript(t.script, NETWORK));
    debug({ dests });
    expect(dests.indexOf(p2sh.address as string)).not.to.eq(-1);
    expect(dests.indexOf(p2wsh.address as string)).not.to.eq(-1);
  });
});
