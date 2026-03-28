const enum Token {
    illegalTok,

    _EOF,
    _Newl,
    _Lit,
    _LitWord,
    _LitRedir,

    sglQuote, // '
    dblQuote, // "
    bckQuote, // `

    and,    // &
    andAnd, // &&
    orOr,   // ||
    or,     // |
    orAnd,  // |&

    dollar,       // $
    dollSglQuote, // $'
    dollDblQuote, // $"
    dollBrace,    // ${
    dollBrack,    // $[
    dollParen,    // $(
    dollDblParen, // $((
    leftBrack,    // [
    dblLeftBrack, // [[
    leftParen,    // (
    dblLeftParen, // ((

    rightBrace,    // }
    rightBrack,    // ]
    rightParen,    // )
    dblRightParen, // ))
    semicolon,     // ;

    dblSemicolon, // ;;
    semiAnd,      // ;&
    dblSemiAnd,   // ;;&
    semiOr,       // ;|

    exclMark, // !
    tilde,    // ~
    addAdd,   // ++
    subSub,   // --
    star,     // *
    power,    // **
    equal,    // ==
    nequal,   // !=
    lequal,   // <=
    gequal,   // >=

    addAssgn, // +=
    subAssgn, // -=
    mulAssgn, // *=
    quoAssgn, // /=
    remAssgn, // %=
    andAssgn, // &=
    orAssgn,  // |=
    xorAssgn, // ^=
    shlAssgn, // <<=
    shrAssgn, // >>=

    rdrOut,   // >
    appOut,   // >>
    rdrIn,    // <
    rdrInOut, // <>
    dplIn,    // <&
    dplOut,   // >&
    clbOut,   // >|
    hdoc,     // <<
    dashHdoc, // <<-
    wordHdoc, // <<<
    rdrAll,   // &>
    appAll,   // &>>

    cmdIn,  // <(
    cmdOut, // >(

    plus,     // +
    colPlus,  // :+
    minus,    // -
    colMinus, // :-
    quest,    // ?
    colQuest, // :?
    assgn,    // =
    colAssgn, // :=
    perc,     // %
    dblPerc,  // %%
    hash,     // #
    dblHash,  // ##
    caret,    // ^
    dblCaret, // ^^
    comma,    // ,
    dblComma, // ,,
    at,       // @
    slash,    // /
    dblSlash, // //
    colon,    // :

    tsExists,  // -e
    tsRegFile, // -f
    tsDirect,  // -d
    tsCharSp,  // -c
    tsBlckSp,  // -b
    tsNmPipe,  // -p
    tsSocket,  // -S
    tsSmbLink, // -L
    tsSticky,  // -k
    tsGIDSet,  // -g
    tsUIDSet,  // -u
    tsGrpOwn,  // -G
    tsUsrOwn,  // -O
    tsModif,   // -N
    tsRead,    // -r
    tsWrite,   // -w
    tsExec,    // -x
    tsNoEmpty, // -s
    tsFdTerm,  // -t
    tsEmpStr,  // -z
    tsNempStr, // -n
    tsOptSet,  // -o
    tsVarSet,  // -v
    tsRefVar,  // -R

    tsReMatch, // =~
    tsNewer,   // -nt
    tsOlder,   // -ot
    tsDevIno,  // -ef
    tsEql,     // -eq
    tsNeq,     // -ne
    tsLeq,     // -le
    tsGeq,     // -ge
    tsLss,     // -lt
    tsGtr,     // -gt

    globQuest, // ?(
    globStar,  // *(
    globPlus,  // +(
    globAt,    // @(
    globExcl   // !(
}

export enum RedirOperator {
    RdrOut = Token.rdrOut,
    AppOut,
    RdrIn,
    RdrInOut,
    DplIn,
    DplOut,
    ClbOut,
    Hdoc,
    DashHdoc,
    WordHdoc,
    RdrAll,
    AppAll
}

export enum ProcOperator {
    CmdIn = Token.cmdIn,
    CmdOut
}

export enum GlobOperator {
    GlobZeroOrOne = Token.globQuest,
    GlobZeroOrMore,
    GlobOneOrMore,
    GlobOne,
    GlobExcept
}

export enum BinCmdOperator {
    AndStmt = Token.andAnd,
    OrStmt,
    Pipe,
    PipeAll
}

export enum CaseOperator {
    Break = Token.dblSemicolon,
    Fallthrough,
    Resume,
    ResumeKorn
}

export enum ParNamesOperator {
    NamesPrefix = Token.star,
    NamesPrefixWords = Token.at
}

export enum ParExpOperator {
    AlternateUnset = Token.plus,
    AlternateUnsetOrNull,
    DefaultUnset,
    DefaultUnsetOrNull,
    ErrorUnset,
    ErrorUnsetOrNull,
    AssignUnset,
    AssignUnsetOrNull,
    RemSmallSuffix,
    RemLargeSuffix,
    RemSmallPrefix,
    RemLargePrefix,
    UpperFirst,
    UpperAll,
    LowerFirst,
    LowerAll,
    OtherParamOps
}

export enum UnAritOperator {
    Not = Token.exclMark,
    BitNegation,
    Inc,
    Dec,
    Plus = Token.plus,
    Minus = Token.minus
}

export enum BinAritOperator {
    Add = Token.plus,
    Sub = Token.minus,
    Mul = Token.star,
    Quo = Token.slash,
    Rem = Token.perc,
    Pow = Token.power,
    Eql = Token.equal,
    Gtr = Token.rdrOut,
    Lss = Token.rdrIn,
    Neq = Token.nequal,
    Leq = Token.lequal,
    Geq = Token.gequal,
    And = Token.and,
    Or = Token.or,
    Xor = Token.caret,
    Shr = Token.appOut,
    Shl = Token.hdoc,

    AndArit = Token.andAnd,
    OrArit = Token.orOr,
    Comma = Token.comma,
    TernQuest = Token.quest,
    TernColon = Token.colon,

    Assgn = Token.assgn,
    AddAssgn = Token.addAssgn,
    SubAssgn = Token.subAssgn,
    MulAssgn = Token.mulAssgn,
    QuoAssgn = Token.quoAssgn,
    RemAssgn = Token.remAssgn,
    AndAssgn = Token.andAssgn,
    OrAssgn = Token.orAssgn,
    XorAssgn = Token.xorAssgn,
    ShlAssgn = Token.shlAssgn,
    ShrAssgn = Token.shrAssgn,
}

export enum UnTestOperator {
    TsExists = Token.tsExists,
    TsRegFile,
    TsDirect,
    TsCharSp,
    TsBlckSp,
    TsNmPipe,
    TsSocket,
    TsSmbLink,
    TsSticky,
    TsGIDSet,
    TsUIDSet,
    TsGrpOwn,
    TsUsrOwn,
    TsModif,
    TsRead,
    TsWrite,
    TsExec,
    TsNoEmpty,
    TsFdTerm,
    TsEmpStr,
    TsNempStr,
    TsOptSet,
    TsVarSet,
    TsRefVar,
    TsNot = Token.exclMark
}