export class BaseException extends Error {
  statusCode: number = 500;
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationException extends BaseException {
  statusCode: 403 = 403;
}

export class RateLimitExceeded extends BaseException {
  statusCode: 429 = 429;
}

export class Unauthorized extends BaseException {
  statusCode: 401 = 401;
}

export class PaymentRequired extends BaseException {
  statusCode: 402 = 402;
}

export class InvalidRequestParameter extends ValidationException {}

export class ParamsMismatchSchema extends InvalidRequestParameter {
  constructor(message: string, readonly details: object) {
    super(message);
  }
}
