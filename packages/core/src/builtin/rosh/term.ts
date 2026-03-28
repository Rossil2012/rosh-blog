import { nthIndexOf, clamp, assert } from "../../internal";
import chalk from 'chalk';
import ansiEscapes from "./ansiEscapes";
import { syntax, Stmt, Parser } from "mvdan-sh";
import { Buffer } from "buffer";

const moveCursorEsc = ({ deltaX, deltaY }: { deltaX: number, deltaY: number }): string => {
  const escX = deltaX === 0 ? '' : deltaX > 0 ? ansiEscapes.cursorForward(deltaX) : ansiEscapes.cursorBackward(-deltaX);
  const escY = deltaY === 0 ? '' : deltaY > 0 ? ansiEscapes.cursorDown(deltaY) : ansiEscapes.cursorUp(-deltaY);
  console.log('xy', deltaX, deltaY, escX.split(''), escY.split(''));
  return escX + escY;
}

const clearCommandEsc = (command: Command, cursor: Cursor): string => {
  const lineNum = command.getLineNum();
  const escEnd = moveCursorEsc(getDeltaPos(cursor, 'moveToEnd'));
  // const escEnd = moveCursorEsc(cursor.moveToEnd());
  const escErase = ansiEscapes.eraseLines(lineNum);
  return escEnd + escErase;
}

class Command {
  private command_: string
  constructor(command: string = '') {
    this.command_ = command.replace(/\r\n/g, '\n');
  }

  private toIndex_(row: number, col: number): number {
    let lineStart = nthIndexOf(this.command_, '\n', row);
    if (lineStart === -1) {
      return -1;
    }
    console.log('Command.toIndex_ before', row, col, lineStart, this.command_.length);

    const index = lineStart + col + (lineStart === 0 ? 0 : 1);

    console.log('Command.toIndex_ after', row, col, lineStart, this.command_.length, index);
    return index > this.command_.length ? -1 : index;
  }

  getString(): string {
    return this.command_.replace(/\n/g, '\r\n');
  }

  getLines(): string[] {
    return this.command_.split('\n');
  }

  getLine(lineNo: number): string | undefined {
    const lines = this.command_.split('\n');
    
    if (lineNo < 0) {
      lineNo = lines.length + lineNo;
    }
    
    return lines[lineNo];
  }

  getLineNum(): number {
    return this.command_.split('\n').length;
  }

  insert(row: number, col: number, str: string): void {
    const index = this.toIndex_(row, col);
    console.log('Command.insert', row, col, str, index, this.command_);
    assert(index >= 0);
    this.command_ = this.command_.slice(0, index) + str + this.command_.slice(index);
  }

  delete(row: number, col: number, n: number): void {
    const index = this.toIndex_(row, col);
    console.log('Command.delete before', row, col, n, index, this.command_);
    assert(index >= 0);

    this.command_ = this.command_.substring(0, index - n) + this.command_.substring(index);
    console.log('Command.delete after', row, col, n, index, this.command_);
  }

  push(str: string): void {
    this.command_ += str.replace(/\r\n/g, '\n');
  }
}

class Cursor {
  private row_!: number;
  private col_!: number;
  private colY_!: number;
  private command_!: Command;
  private prompt_!: string;

  setCommand(command: Command, prompt: string): void {
    this.command_ = command;
    this.prompt_ = prompt;
    this.row_ = this.col_ = this.colY_ = 0;
  }

  getPosition(): { row: number, col: number } {
    return { row: this.row_, col: this.col_ };
  }

  getCommandPosition(): { row: number, col: number } {
    return { row: this.row_, col: this.col_ - (this.row_ > 0 ? 0 : this.prompt_.length) };
  }

  getOffset(): number {
    const lines = this.command_.getLines();

    let offset = 0;
    for (const line of lines.slice(0, this.row_)) {
      offset += line.length + 1;
    }
    offset += this.getCommandPosition().col;

    return offset;
  }

  moveToOffset(offset: number) {
    offset = Math.max(0, offset);
    const lines = this.command_.getLines();

    console.log('Cursor.moveToOffset before', offset, this.row_, this.col_);
    this.row_ = this.col_ = 0;
    console.log('Cursor.moveToOffset mid', offset, this.row_, this.col_);

    for (const line of lines) {
      if (offset < line.length + 1) {
        this.setCol_(offset);
        return;
      }
      this.row_++;
      offset -= line.length + 1;
    }

    this.row_--;
    this.setCol_(lines.at(-1)!.length);

    console.log('Cursor.moveToOffset after', offset, this.row_, this.col_);

    return;
  }

  moveX(offset: number): void {
    this.move_(offset, 'X');
  }

  moveY(offset: number): void {
    this.move_(offset, 'Y');
  }

  moveToStart(): void {
    this.setRow_(0);
    this.setCol_(0);
    this.colY_ = 0;
  }

  moveToEnd(): void {
    const lastLine = this.command_.getLine(-1)!;
    this.setRow_(this.command_.getLineNum() - 1);
    this.setCol_(lastLine.length);
    this.colY_ = lastLine.length;
  }

  private setRow_(row: number) {
    this.row_ = row;
  }

  private setCol_(col: number, refRow?: number) {
    const condRow = refRow ?? this.row_;
    this.col_ = col + (condRow === 0 ? this.prompt_.length : 0);
  }

  private move_(offset: number, direction: 'X' | 'Y'): void {
    const steps = Math.abs(offset);
    for (let i = 0; i < steps; i++) {
      if (direction === 'X') {
        this.moveOneX_(offset);
      } else {
        this.moveOneY_(offset);
      }
    }
  }

  private moveOneX_(offset: number): void {
    if (offset === 0) {
      return;
    }

    console.log('Cursor.moveOneX_ before', offset, this);

    offset = offset > 0 ? 1 : -1;
    const { row, col } = this.getCommandPosition();
    const line = this.command_.getLine(row)!;
    if (offset > 0 && col + 1 > line.length) {
      if (this.row_ < this.command_.getLineNum() - 1) {
        this.setRow_(row + 1);
        this.setCol_(0);
        this.colY_ = 0;
      }
      return;
    } else if (offset < 0 && col - 1 < 0) {
      if (row > 0) {
        const prevLine = this.command_.getLine(row - 1)!;
        this.setRow_(row - 1);
        this.setCol_(prevLine.length);
        this.colY_ = prevLine.length;
      }
      return;
    }

    this.col_ += offset;
    this.colY_ += offset;

    console.log('Cursor.moveOneX_ after', offset, this);
  }

  private moveOneY_(offset: number): void {
    console.log('Cursor.moveOneY_ before', offset, this.row_, this.col_, this.colY_);
    if ((this.row_ === 0 && offset < 0) || (this.row_ === this.command_.getLineNum() - 1 && offset > 0)) {
      return;
    }

    offset = offset > 0 ? 1 : -1;
    const newLine = this.command_.getLine(this.row_ + offset)!;
    this.setRow_(this.row_ + offset);
    this.setCol_(Math.min(this.colY_, newLine.length));
    console.log('Cursor.moveOneY_ after', offset, this.row_, this.col_, this.colY_, newLine.length, this.prompt_.length);
  }
}

const getDeltaPos = (cursor: Cursor, method: string, ...args: any[]): { deltaX: number, deltaY: number } => {
  const { row: origRow, col: origCol } = cursor.getPosition();
  (cursor as any)[method].bind(cursor)(...args);
  const { row, col } = cursor.getPosition();
  return { deltaX: col - origCol, deltaY: row - origRow };
}

export class Term {
  private parser_!: Parser;
  private prompt_!: string;
  private currentCommand_!: Command;
  private allCommands_!: Command[];
  private commandIndex_!: number;
  private cursor_!: Cursor;

  private styledPrompt_() {
    return chalk.cyanBright.bold(this.prompt_);
  }

  init(prompt: string) {
    this.parser_ = syntax.NewParser(syntax.Variant(syntax.LangBash));
    this.prompt_ = prompt;
    this.currentCommand_ = new Command();
    this.allCommands_ = [new Command()];
    this.commandIndex_ = 0;
    this.cursor_ = new Cursor();
    this.cursor_.setCommand(this.currentCommand_, prompt);
    this.cursor_.moveToEnd();
  }

  getPromt(): Buffer {
    return Buffer.from(this.styledPrompt_());
  }

  setPrompt(prompt: string) {
    this.prompt_ = prompt;
  }

  parseFile(content: string): Stmt[] {
    return this.parser_.Parse(content).Stmts.map(stmt => stmt!);
  }

  write(key: string): Buffer {
    const { row, col } = this.cursor_.getCommandPosition();
    console.log('Term.write', row, col, key, this.cursor_, this.currentCommand_, this.allCommands_);
    this.currentCommand_.insert(row, col, key);
    this.cursor_.moveX(key.length);
    let toWrite = this.currentCommand_.getLine(row)!.slice(col + key.length);
    toWrite += toWrite.length > 0 ? ansiEscapes.cursorBackward(toWrite.length) : '';

    return Buffer.from(key + toWrite);
  }

  backspace(): Buffer {
    const { row: origRow, col: origCol } = this.cursor_.getCommandPosition();
    const origOffset = this.cursor_.getOffset();
    console.log('Term.backspace before', origRow, origCol, origOffset);
    const clearEsc = clearCommandEsc(this.currentCommand_, this.cursor_);
    this.currentCommand_.delete(origRow, origCol, 1);
    this.cursor_.moveToEnd();
    const delta = getDeltaPos(this.cursor_, 'moveToOffset', origOffset - 1);
    const cursurEsc = moveCursorEsc(delta);
    // const cursurEsc = moveCursorEsc(this.cursor_.moveToOffset(origOffset - 1));
    console.log('Term.backspace after', origRow, origCol, origOffset, delta);

    return Buffer.from(clearEsc + this.styledPrompt_() + this.currentCommand_.getString() + cursurEsc);
  }

  enter(): { complete: boolean, statements: Stmt[], writeBeforeExec: Buffer } {
    let statements: (Stmt | null)[] | undefined;
    try {
      statements = this.parser_.Parse(this.currentCommand_.getString() + '\n').Stmts;
    } catch (err) {
      if (syntax.IsIncomplete(err)) {
        this.currentCommand_.push('\r\n');
        return {
          complete: false,
          statements: [], 
          writeBeforeExec: Buffer.from(moveCursorEsc(getDeltaPos(this.cursor_, 'moveToEnd')))
        };
      }

      // return { toWrite: Buffer.from(moveCursorEsc(this.cursor_.moveToEnd())), statements: [] };
    }

    console.log('Term.enter before', this.cursor_, this.currentCommand_, this.allCommands_);
    const deltaPos = getDeltaPos(this.cursor_, 'moveToEnd');
    // const { deltaX, deltaY } = this.cursor_.moveToEnd();
    this.allCommands_[this.allCommands_.length - 1] = this.currentCommand_;
    this.allCommands_.push(new Command());
    this.currentCommand_ = new Command();
    this.cursor_.setCommand(this.currentCommand_, this.prompt_);
    this.cursor_.moveToEnd();
    this.commandIndex_ = this.allCommands_.length - 1;

    console.log('Term.enter after', this.cursor_, deltaPos, this.currentCommand_, this.allCommands_);

    return {
      complete: true,
      statements: statements?.map(stmt => stmt!) ?? [],
      writeBeforeExec: Buffer.from(moveCursorEsc(deltaPos) + '\r\n' + (statements ? '' : chalk.redBright('Bad Syntax!\r\n')))
    }
  }

  newCommand(): Buffer {
    return Buffer.from(this.styledPrompt_());
  }

  arrowX(offset: number): Buffer {
    return Buffer.from(moveCursorEsc(getDeltaPos(this.cursor_, 'moveX', offset)));
    // return Buffer.from(moveCursorEsc(this.cursor_.moveX(offset)));
  }

  arrowY(offset: number): Buffer {
    const lineNum = this.currentCommand_.getLineNum();
    const { deltaX, deltaY } = getDeltaPos(this.cursor_, 'moveY', offset);
    // const { deltaX, deltaY } = this.cursor_.moveY(offset);

    console.log('arrow', offset, lineNum, this.commandIndex_, this.cursor_, this.allCommands_, deltaX, deltaY);
    if (deltaY === 0) {
      console.log('arrow cross line');
      this.allCommands_[this.commandIndex_] = this.currentCommand_;
      this.commandIndex_ = clamp(this.commandIndex_ + offset, 0, this.allCommands_.length - 1);
      this.currentCommand_ = this.allCommands_[this.commandIndex_];
      this.cursor_.setCommand(this.currentCommand_, this.prompt_);
      this.cursor_.moveToEnd();
      const eraseEsc = (offset < 0 && lineNum > 1 ? ansiEscapes.cursorDown(lineNum - 1) : '') + ansiEscapes.eraseLines(lineNum);
      return Buffer.from(eraseEsc + this.styledPrompt_() + this.currentCommand_.getString());
    } else {
      console.log('arrow in line');
      return Buffer.from(moveCursorEsc({ deltaX, deltaY }));
    }
  }
}