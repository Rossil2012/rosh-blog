import { assert } from '../../internal';

type TestFunction = (args: string[]) => boolean
type TestMap = Record<string, TestFunction>;

const splitArray = <T>(arr: Array<T>, filterFcn: (elem: T) => boolean): [Array<T>, Array<T>] => {
  return [
    arr.filter(filterFcn),
    arr.filter(e => !filterFcn(e))
  ];
}

const binary: TestMap = {
  '-eq': args => parseInt(args[0]) === parseInt(args[1]),
  '-ne': args => parseInt(args[0]) !== parseInt(args[1]),
  '-gt': args => parseInt(args[0]) > parseInt(args[1]),
  '-lt': args => parseInt(args[0]) < parseInt(args[1]),
  '-ge': args => parseInt(args[0]) >= parseInt(args[1]),
  '-le': args => parseInt(args[0]) <= parseInt(args[1])
}

const unary: TestMap = {
  '=': args => args[0] === args[1],
  '!=': args => args[0] !== args[1],
  '-z': args => args[0].length === 0,
  '-n': args => args[0].length > 0,
  '<': args => args[0] < args[1],
  '>': args => args[0] > args[1],
};

export const evalBracketCommand = (args: string[]): number => {
  assert(args.pop() === ']', 'rosh: [: missing `]');
  const [operators, operands] = splitArray(args, arg => arg.startsWith('-') || arg in binary || arg in unary);
  const operator = operators.length === 0 ? '-n' : operators[0];

  let testFcn: TestFunction;
  if (operator in binary) {
    assert(operands.length === 2, 'rosh: [: 2 arguments required');
    testFcn = binary[operator];
  } else if (operator in unary) {
    assert(operands.length === 1, 'rosh: [: 1 argument required');
    testFcn = unary[operator];
  } else {
    throw new Error('rosh: [: unknown operator');
  }

  console.log('!!asd', testFcn, operands, 1 - +testFcn(operands));

  return 1 - +testFcn(operands);
}
