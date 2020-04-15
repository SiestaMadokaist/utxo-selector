import { BD } from './modules/BigDecimal';
export namespace UTXO {
  export type ByteSize = BD.Value<0>;

  export interface AddressBase58 extends String {
    readonly sym?: unique symbol;
  }

  export interface ID extends String {
    readonly sym?: unique symbol;
  }

  export interface Hash extends Buffer {
    readonly sym?: unique symbol;
  }

  type InputHash = ID | Hash;

  export interface VOutIndex extends Number {
    readonly sym?: unique symbol;
  }

  export interface RedeemScript extends Buffer {
    readonly sym?: unique symbol;
  }

  export interface WitnessScript extends Buffer {
    readonly sym?: unique symbol;
  }

  export interface NonWitnessUTXO extends Buffer {
    readonly sym?: unique symbol;
  }

  interface WitnessUTXOScript extends Buffer {
    readonly sym?: unique symbol;
  }

  export interface WitnessUTXO {
    script: WitnessUTXOScript;
    value: BD.Value<-8>;
  }

  interface BaseInput {
    hash?: InputHash;
    index: VOutIndex;
    nonWitnessUtxo?: NonWitnessUTXO;
    redeemScript?: RedeemScript;
    witnessScript?: WitnessScript;
    witnessUtxo?: WitnessUTXO;
  }

  export interface WitnessInput extends BaseInput {
    hash: InputHash;
    index: VOutIndex;
    nonWitnessUtxo?: NonWitnessUTXO;
    witnessUtxo: WitnessUTXO;
  }

  export interface NonWitnessInput extends BaseInput {
    hash: InputHash;
    index: VOutIndex;
    nonWitnessUtxo: NonWitnessUTXO;
    witnessUtxo?: WitnessUTXO;
  }

  export type Input = WitnessInput | NonWitnessInput;

  export interface TxOutput {
    address: AddressBase58;
    value: BD.Value<-8>;
  }

  export interface SelectorProps {
    changeAddress: AddressBase58;
    feeRate: number;
    inputs: Input[];
    outputs: TxOutput[];
  }

}
