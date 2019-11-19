<template>
    <GridLayout @touch="reactToTouch" columns="*" rows="*" :width="size" :height="size" background="red">
        <WebViewExt dock="center" src="~/components/chessboard/stockfish/index.html"
                width="0" height="0"
                row="0" col="0"
                @loadFinished="onWebViewLoaded"
            />
        <CanvasView  dock="center" :width="size" :height="size" @draw="drawBoard" ref="canvas" row="0" col="0"
        />
        <ActivityIndicator :busy="computerIsThinking" />
        <StackLayout id="gameEndedText" orientation="vertical" :width="size" :height="size"
            verticalAlignment="center" dock="center"
            :class="{opened: !gameInProgress}">
            <Label :text="gameEndedReason | L" :fontSize="cellSize * 0.8" textWrap="true" color="red"
             />
        </StackLayout>
        <StackLayout dock="center" orientation="vertical" id="promotionDialog"
                :width="size" :height="size"
                row="0" col="0"
                :class="{opened: promotionDialogOpened}"
                :set="whiteTurn = this.boardLogic.turn() === 'w'"
            >
            <Label id="title" :text="'choose_promotion_piece' | L" horizontalAlignment="center" :fontSize="cellSize * 0.5"/>
            <StackLayout orientation="horizontal" @tap="commitPromotion('q')" horizontalAlignment="left" width="100%">
                <Label :text="queenFigurine(whiteTurn)" :fontSize="cellSize * 0.8" />
                <Label :text="'queen_promotion' | L" :fontSize="cellSize * 0.8" />
            </StackLayout>
            <StackLayout orientation="horizontal" @tap="commitPromotion('r')" horizontalAlignment="left" width="100%">
                <Label :text="rookFigurine(whiteTurn)" :fontSize="cellSize * 0.8" />
                <Label :text="'rook_promotion' | L" :fontSize="cellSize * 0.8" />
            </StackLayout>
            <StackLayout orientation="horizontal" @tap="commitPromotion('b')" horizontalAlignment="left" width="100%">
                <Label :text="bishopFigurine(whiteTurn)" :fontSize="cellSize * 0.8" />
                <Label :text="'bishop_promotion' | L" :fontSize="cellSize * 0.8" />
            </StackLayout>
            <StackLayout orientation="horizontal" @tap="commitPromotion('n')" horizontalAlignment="left" width="100%">
                <Label :text="knightFigurine(whiteTurn)" :fontSize="cellSize * 0.8" />
                <Label :text="'knight_promotion' | L" :fontSize="cellSize * 0.8" />
            </StackLayout>
        </StackLayout>
    </GridLayout>
</template>

<script>
import "@nota/nativescript-webview-ext/vue";
import CanvasPlugin from 'nativescript-canvas/vue';
import Chess from 'chess.js';
import PlayerType from "./PlayerType";

import Vue from "nativescript-vue";
import { localize } from "nativescript-localize";
import { Color } from 'tns-core-modules/color/color';
import { Canvas, Cap, drawRect, createRect, Paint, Style} from 'nativescript-canvas';

import { knownFolders, path } from 'tns-core-modules/file-system/file-system';
import { ImageSource } from 'tns-core-modules/image-source/image-source';

let piecesPictures = [];

const loadPiecePicture = (refShortcut) => {
    piecesPictures[refShortcut] = ImageSource.fromFileSync(path.join( knownFolders.currentApp().path, 'components/chessboard/chess_vectors/'+refShortcut+'.png'));
}
for (let shortcut of ['pl', 'nl', 'bl', 'rl', 'ql', 'kl', 'pd', 'nd', 'bd', 'rd', 'qd', 'kd']) {
    loadPiecePicture(shortcut);
}

Vue.filter("L", localize);
Vue.use(CanvasPlugin);

export default {
    props: {
        size: {
            type: Number,
            default: 200,
        },
        backgroundColor: {
            type: String,
            default: "#1A6A15"
        },
        whiteCellColor: {
            type: String,
            default: "#ffce9e"
        },
        blackCellColor: {
            type: String,
            default: "#d18b47"
        },
        coordsColor: {
            type: String,
            default: "#fca02b"
        },
        reversed: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            piecesPictures: piecesPictures,
            webview: undefined,
            boardLogic: new Chess('8/8/8/8/8/8/8/8 w - - 0 1'),
            dndActive: false,
            dndOriginFile: undefined,
            dndOriginRank: undefined,
            dndDestFile: undefined,
            dndDestRank: undefined,
            promotionDialogOpened: false,
            boardOrientationBeforePromotionDialog: undefined,
            gameInProgress: false,
            gameEndedReason: undefined,
            lastMove: undefined,
            whitePlayerType: undefined,
            blackPlayerType: undefined,
            computerIsThinking: false,
            playedMoves: [],
            startPosition: undefined,
            historyCursorIndex: undefined,
        };
    },
    computed: {
        cellSize() {
            return this.size / 9.0;
        },
        halfCellSize() {
            return this.cellSize / 2.0;
        },
        fontSize() {
            return this.cellSize * 0.4;
        },
    },
    watch: {
        reversed: function (newVal, oldVal) {
            const canvas = this.$refs.canvas.nativeView;
            canvas.redraw();
        }
    },
    methods: {
        onWebViewLoaded(args) {
            this.webview = args.object;
            try {
                this.webview.on('stockfishOutput', this.processStockfishOutput);
            }
            catch (error) {
                console.error(error);
            }
        },
        sendCommandToStockfish(command) {
            if (this.webview !== undefined) {
                try {
                    this.webview.executeJavaScript(`stockfish.postMessage('${command}');`);
                }
                catch (error) {
                    console.error(error);
                }
            }
        },
        processStockfishOutput(output) {
            const result = output.data;
            if (!result.startsWith("bestmove")) return;

            const parts = result.split(" ");
            const moveString = parts[1];
            const moveData = this._moveStringFromEngineToMoveData(moveString);
            this._commitComputerMove(moveData);
        },
        makeComputerPlayIfComputerTurn() {
            if (!this.gameInProgress) return;
            const whiteTurn = this.boardLogic.turn() === 'w';
            const computerToPlay = whiteTurn ?
                 this.whitePlayerType === PlayerType.Computer :
                 this.blackPlayerType === PlayerType.Computer;

            if (!computerToPlay) return;

            this.computerIsThinking = true;

            const currentPositionFEN = this.boardLogic.fen();
            this.sendCommandToStockfish(`position fen ${currentPositionFEN}`);
            this.sendCommandToStockfish("go depth 20");
        },
        gameIsRunning() {
            return this.gameInProgress;
        },
        stopGame() {
            this.gameInProgress = false;
            this.historyCursorIndex = this.playedMoves.length - 1;
            this.$emit('historyselection', this.historyCursorIndex);
        },
        startNewGame({whitePlayerType, blackPlayerType, startPositionStr}) {
            this.cancelDnd();
            this.promotionDialogOpened = false;
            const startPosition = startPositionStr || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
            this.boardLogic = new Chess(startPosition);
            this.whitePlayerType = whitePlayerType || PlayerType.Human;
            this.blackPlayerType = blackPlayerType || PlayerType.Human;
            this.gameEndedReason = undefined;
            this.gameInProgress = true;
            this.lastMove = undefined;
            this.startPosition = startPosition;
            this.playedMoves = [];
            this.historyCursorIndex = undefined;

            const currentFen = this.boardLogic.fen();
            const moveNumber = parseInt(currentFen.split(" ")[5]);
            this.$emit('newgame', {
                moveNumber: moveNumber,
                whiteMove: this.boardLogic.turn() === 'w',
            });
            const canvas = this.$refs.canvas.nativeView;
            this.checkGameEndedStateAndNotifyUser();
            canvas.redraw();
            this.makeComputerPlayIfComputerTurn();
        },
        pieceAt(rank, file) {
            const square = `${String.fromCharCode('a'.charCodeAt(0) + file)}${String.fromCharCode('1'.charCodeAt(0) + rank)}`;
            const piece = this.boardLogic.get(square);
            return piece;
        },
        pieceImageShortcutAtRankFile(rank, file) {
            let isTheMovingPiece = this.dndOriginRank === rank && this.dndOriginFile === file;

            if (isTheMovingPiece) return null;

            const piece = this.pieceAt(rank, file);
            if (piece === null) return null;
            let imageBase;
            switch(piece.type) {
                case 'p': imageBase = piece.color === 'b' ? 'pd' : 'pl'; break;
                case 'n': imageBase = piece.color === 'b' ? 'nd' : 'nl'; break;
                case 'b': imageBase = piece.color === 'b' ? 'bd' : 'bl'; break;
                case 'r': imageBase = piece.color === 'b' ? 'rd' : 'rl'; break;
                case 'q': imageBase = piece.color === 'b' ? 'qd' : 'ql'; break;
                case 'k': imageBase = piece.color === 'b' ? 'kd' : 'kl'; break;
            }
            if (!imageBase) return null;
            return imageBase;
        },
        fileCoords(index) {
            return this.reversed ? ['H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'][index] : ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'][index];
        },
        rankCoords(index) {
            return this.reversed ? ['1', '2', '3', '4', '5', '6', '7', '8'][index]: ['8', '7', '6', '5', '4', '3', '2', '1'][index];
        },
        turnColor() {
            switch(this.boardLogic.turn()) {
                case 'w': return 'white';
                case 'b': return 'black';
                default: return 'transparent';
            }
        },
        movedPieceImage() {
            if (!this.dndActive) return null;
            return this.dndMovedPieceImage;
        },
        movedPieceTop() {
            if (!this.dndActive) return undefined;
            if (this.promotionDialogOpened) {
                const boardReversedSincePromotionDialog = this.boardOrientationBeforePromotionDialog !== this.reversed;
                const realTop = boardReversedSincePromotionDialog ? (this.size - this.dndMovedPieceTop - this.cellSize) : this.dndMovedPieceTop;
                return realTop;
            }
            else {
                return this.dndMovedPieceTop;
            }
        },
        movedPieceLeft() {
            if (!this.dndActive) return undefined;
            if (this.promotionDialogOpened) {
                const boardReversedSincePromotionDialog = this.boardOrientationBeforePromotionDialog !== this.reversed;
                const realLeft = boardReversedSincePromotionDialog ? (this.size - this.dndMovedPieceLeft - this.cellSize) : this.dndMovedPieceLeft;
                return realLeft;
            }
            else {
                return this.dndMovedPieceLeft;
            }
        },
        queenFigurine(whiteTurn) {
            return whiteTurn ? '\u2655' : '\u265B';
        },
        rookFigurine(whiteTurn) {
            return whiteTurn ? '\u2656' : '\u265C';
        },
        bishopFigurine(whiteTurn) {
            return whiteTurn ? '\u2657' : '\u265D';
        },
        knightFigurine(whiteTurn) {
            return whiteTurn ? '\u2658' : '\u265E';
        },
        commitPromotion(typeStr) {
            const moveNumber =  parseInt(this.boardLogic.fen().split(" ")[5]);
            this.promotionDialogOpened = false;
            this.boardOrientationBeforePromotionDialog = undefined;
            this.boardLogic.move({from: this.startCellStr, to: this.endCellStr, promotion: typeStr});
            const lastMoveIsWhite = this.boardLogic.turn() === 'b'; 
            const history = this.boardLogic.history();
            let lastMoveSan = history[history.length - 1];
            lastMoveSan = lastMoveSan.replace('K', lastMoveIsWhite ? '\u2654' : '\u265A');
            lastMoveSan = lastMoveSan.replace('Q', lastMoveIsWhite ? '\u2655' : '\u265B');
            lastMoveSan = lastMoveSan.replace('R', lastMoveIsWhite ? '\u2656' : '\u265C');
            lastMoveSan = lastMoveSan.replace('B', lastMoveIsWhite ? '\u2657' : '\u265D');
            lastMoveSan = lastMoveSan.replace('N', lastMoveIsWhite ? '\u2658' : '\u265E');
            this.lastMove = {
                origin: {
                    file: this.dndOriginFile,
                    rank: this.dndOriginRank,
                },
                dest: {
                    file: this.dndDestFile,
                    rank: this.dndDestRank,
                }
            };
            this.cancelDnd();
            this.playedMoves.push({
                positionFen: this.boardLogic.fen(),
                lastMove: this.lastMove,
            });

            this.$emit('movesan', {
                moveNumber,
                san: lastMoveSan,
                whiteMove: lastMoveIsWhite,
            });
            this.checkGameEndedStateAndNotifyUser();

            const canvas = this.$refs.canvas.nativeView;
            canvas.redraw();
            if (this.gameInProgress) this.makeComputerPlayIfComputerTurn();
        },
        cancelDnd() {
            this.dndActive = false;
            this.dndOriginFile = undefined;
            this.dndOriginRank = undefined;
            this.dndDestFile = undefined;
            this.dndDestRank = undefined;
            this.dndMovedPieceTop = undefined;
            this.dndMovedPieceLeft = undefined;
            this.dndMovedPieceImage = undefined;
            this.startCellStr = undefined;
            this.endCellStr = undefined;
            const canvas = this.$refs.canvas.nativeView;
            canvas.redraw();
        },
        checkGameEndedStateAndNotifyUser() {
            if (this.boardLogic.in_checkmate()) {
                this.gameInProgress = false;
                this.gameEndedReason = 'game_ending_mate';
                this.historyCursorIndex = this.playedMoves.length - 1;
                this.$emit('gameended');
                this.$emit('historyselection', this.historyCursorIndex);
            } else if (this.boardLogic.in_stalemate()) {
                this.gameInProgress = false;
                this.gameEndedReason = 'game_ending_draw_stalemate';
                this.historyCursorIndex = this.playedMoves.length - 1;
                this.$emit('gameended');
                this.$emit('historyselection', this.historyCursorIndex);
            } else if (this.boardLogic.in_threefold_repetition()) {
                this.gameInProgress = false;
                this.gameEndedReason = 'game_ending_draw_three_fold_repetitions';
                this.historyCursorIndex = this.playedMoves.length - 1;
                this.$emit('gameended');
                this.$emit('historyselection', this.historyCursorIndex);
            } else if (this.boardLogic.insufficient_material()) {
                this.gameEndedReason = 'game_ending_draw_missing_material';
                this.historyCursorIndex = this.playedMoves.length - 1;
                this.gameInProgress = false;
                this.$emit('gameended');
                this.$emit('historyselection', this.historyCursorIndex);
            } else if (this.boardLogic.in_draw()) {
                this.gameInProgress = false;
                this.gameEndedReason = 'game_ending_draw_fifty_moves_rule';
                this.historyCursorIndex = this.playedMoves.length - 1;
                this.$emit('gameended');
                this.$emit('historyselection', this.historyCursorIndex);
            }
        },
        reactToTouch(event) {
            const whiteTurn = this.boardLogic.turn() === 'w';
            const humanToPlay = whiteTurn ?
                 this.whitePlayerType === PlayerType.Human :
                 this.blackPlayerType === PlayerType.Human;

            if (!humanToPlay) return;

            const canvas = this.$refs.canvas.nativeView;

            const rankAndFileToCoordinate = function(rank, file) {
                return `${String.fromCharCode('a'.charCodeAt(0) + file)}${String.fromCharCode('1'.charCodeAt(0) + rank)}`;
            }

            if (! this.gameInProgress) return;
            if (this.promotionDialogOpened) return;

            const col = Math.floor((event.getX() - this.halfCellSize) / this.cellSize);
            const row = Math.floor((event.getY() - this.halfCellSize) / this.cellSize);
            const outsideZone = col < 0 || col > 7 || row < 0 || row > 7;

            if (outsideZone) {
                this.cancelDnd();
            }

            const file = this.reversed ? 7-col : col;
            const rank = this.reversed ? row : 7-row;
            const pieceAtClickedSquare = this.boardLogic.get(rankAndFileToCoordinate(rank, file));

            switch(event.action) {
                case 'down':
                    const pieceImageShortcut = this.pieceImageShortcutAtRankFile(rank, file);
                    const isAnEmptyCell = pieceImageShortcut === null;
                    if (isAnEmptyCell) return;
                    const notOurPiece = this.boardLogic.turn() !== pieceAtClickedSquare.color;
                    if (notOurPiece) return;
                    this.dndMovedPieceImage = this.piecesPictures[pieceImageShortcut];
                    this.dndActive = true;
                    this.dndOriginFile = file;
                    this.dndOriginRank = rank;
                    this.dndDestFile = file;
                    this.dndDestRank = rank;
                    this.dndMovedPieceLeft = event.getX() - this.halfCellSize;
                    this.dndMovedPieceTop = event.getY() - this.halfCellSize;

                    canvas.redraw();
                    break;
                case 'move':
                    if (! this.dndActive) return;

                    this.dndDestFile = file;
                    this.dndDestRank = rank;
                    this.dndMovedPieceLeft = event.getX() - this.halfCellSize;
                    this.dndMovedPieceTop = event.getY() - this.halfCellSize;

                    canvas.redraw();

                    break;
                case 'up':
                    if (!this.dndActive) return;

                    this.dndDestFile = file;
                    this.dndDestRank = rank;

                    this.startCellStr = rankAndFileToCoordinate(this.dndOriginRank, this.dndOriginFile);
                    this.endCellStr = rankAndFileToCoordinate(rank, file);

                    const boardLogicClone = new Chess(this.boardLogic.fen());
                    const moveResult = boardLogicClone.move({from: this.startCellStr, to: this.endCellStr, promotion: 'q'}) ;
                    const isValidMove = moveResult !== null;

                    if (isValidMove) {
                        const isAPromotionMove = moveResult.promotion !== undefined;
                        if (isAPromotionMove) {
                            this.boardOrientationBeforePromotionDialog = this.reversed;
                            this.promotionDialogOpened = true;
                        }
                        else {
                            const moveNumber =  parseInt(this.boardLogic.fen().split(" ")[5]);
                            this.boardLogic.move({from: this.startCellStr, to: this.endCellStr});
                            const lastMoveIsWhite = this.boardLogic.turn() === 'b'; 
                            const history = this.boardLogic.history();
                            let lastMoveSan = history[history.length - 1];
                            lastMoveSan = lastMoveSan.replace('K', lastMoveIsWhite ? '\u2654' : '\u265A');
                            lastMoveSan = lastMoveSan.replace('Q', lastMoveIsWhite ? '\u2655' : '\u265B');
                            lastMoveSan = lastMoveSan.replace('R', lastMoveIsWhite ? '\u2656' : '\u265C');
                            lastMoveSan = lastMoveSan.replace('B', lastMoveIsWhite ? '\u2657' : '\u265D');
                            lastMoveSan = lastMoveSan.replace('N', lastMoveIsWhite ? '\u2658' : '\u265E');
                            this.lastMove = {
                                origin: {
                                    file: this.dndOriginFile,
                                    rank: this.dndOriginRank,
                                },
                                dest: {
                                    file: this.dndDestFile,
                                    rank: this.dndDestRank,
                                }
                            };
                            this.cancelDnd();

                            this.playedMoves.push({
                                positionFen: this.boardLogic.fen(),
                                lastMove: this.lastMove,
                            });

                            this.$emit('movesan', {
                                moveNumber,
                                san: lastMoveSan,
                                whiteMove: lastMoveIsWhite,
                            });
                            this.checkGameEndedStateAndNotifyUser();

                            canvas.redraw();
                            if (this.gameInProgress) this.makeComputerPlayIfComputerTurn();
                        }
                    }
                    else {
                        this.cancelDnd();
                        canvas.redraw();
                    }
            }
        },
        gotoHistory(positionIndex) {
            if (this.gameInProgress) return;

            const canvas = this.$refs.canvas.nativeView;

            if (positionIndex === 'first') {
                this.boardLogic.load(this.startPosition);
                this.lastMove = undefined;
                this.historyCursorIndex = -1;
                canvas.redraw();
                this.$emit('historyselection', undefined);
            }
            else if (positionIndex === 'last') {
                const lastPlayedMoveIndex = this.playedMoves.length - 1;
                this.historyCursorIndex = lastPlayedMoveIndex;
                this.boardLogic.load(this.playedMoves[this.historyCursorIndex].positionFen);
                this.lastMove = this.playedMoves[this.historyCursorIndex].lastMove;
                canvas.redraw();
                this.$emit('historyselection', this.historyCursorIndex);
            }
            else if (positionIndex === 'previous') {
                if (this.historyCursorIndex !== undefined && this.historyCursorIndex > -1) {
                    this.historyCursorIndex--;
                    if (this.historyCursorIndex < 0) {
                        this.boardLogic.load(this.startPosition);
                        this.lastMove = undefined;
                        this.historyCursorIndex = -1;
                        canvas.redraw();
                        this.$emit('historyselection', undefined);
                    } else {
                        this.boardLogic.load(this.playedMoves[this.historyCursorIndex].positionFen);
                        this.lastMove = this.playedMoves[this.historyCursorIndex].lastMove;
                        canvas.redraw();
                        this.$emit('historyselection', this.historyCursorIndex);
                    }
                }
            }
            else if (positionIndex === 'next') {
                if (this.historyCursorIndex !== undefined && this.historyCursorIndex < this.playedMoves.length - 1) {
                    this.historyCursorIndex++;
                    this.boardLogic.load(this.playedMoves[this.historyCursorIndex].positionFen);
                    this.lastMove = this.playedMoves[this.historyCursorIndex].lastMove;
                    canvas.redraw();
                    this.$emit('historyselection', this.historyCursorIndex);
                }
            }
            else if (positionIndex >= 0) {
                if (positionIndex >= this.playedMoves.length) return;
                this.historyCursorIndex = positionIndex;
                this.boardLogic.load(this.playedMoves[this.historyCursorIndex].positionFen);
                this.lastMove = this.playedMoves[this.historyCursorIndex].lastMove;
                canvas.redraw();
                this.$emit('historyselection', this.historyCursorIndex);
            }
        },
        drawBoard(event) {
            const { canvas } = event;

            this._drawBackground(canvas);
            this._drawCoordinates(canvas);
            this._drawCells(canvas);
            this._drawPieces(canvas);
            this._drawLastMoveArrow(canvas);
            this._drawPlayerTurn(canvas);
            this._drawMovedPiece(canvas);
        },
        _drawBackground(canvas) {
            const paint = new Paint();
            paint.setColor(new Color(this.backgroundColor));
            paint.setStyle(Style.FILL);
            canvas.drawRect(createRect(0, 0, this.size, this.size), paint);
        },
        _drawCoordinates(canvas) {
            const paint = new Paint();
            paint.setColor(new Color(this.coordsColor));
            paint.setTextSize(this.cellSize * 0.4);
            paint.setAntiAlias(true);

            for (let row of [0,1,2,3,4,5,6,7]) {
                const text = this.rankCoords(row);
                const y = this.cellSize * (1.15 + row);
                const left = this.cellSize * 0.13;
                const right = this.cellSize * 8.63;

                canvas.drawText(text, left, y, paint);
                canvas.drawText(text, right, y, paint);
            }

            for (let col of [0,1,2,3,4,5,6,7]) {
                const text = this.fileCoords(col);
                const x = this.cellSize * (0.9 + col);
                const top = this.cellSize * 0.40;
                const bottom = this.cellSize * 8.90;

                canvas.drawText(text, x, top, paint);
                canvas.drawText(text, x, bottom, paint);
            }
        },
        _drawCells(canvas) {
            const paint = new Paint();
            paint.setStyle(Style.FILL);

            for (let row of [0,1,2,3,4,5,6,7]) {
                for (let col of [0,1,2,3,4,5,6,7]) {
                    const whiteCell = (row+col) %2 === 0;
                    let color = whiteCell ? this.whiteCellColor : this.blackCellColor;
                    const file = this.reversed ? 7-col : col;
                    const rank = this.reversed ? row : 7-row;
                    
                    if (this.dndDestFile === file || this.dndDestRank === rank) color = 'green';
                    if (this.dndOriginFile === file && this.dndOriginRank === rank) color = 'red';
                    const x = this.cellSize * (0.5 + col);
                    const y = this.cellSize * (0.5 + row);

                    paint.setColor(new Color(color));
                    canvas.drawRect(createRect(x, y, this.cellSize, this.cellSize), paint);
                }
            }
        },
        _drawPieces(canvas) {
            for (let row of [0,1,2,3,4,5,6,7]) {
                for (let col of [0,1,2,3,4,5,6,7]) {
                    const file = this.reversed ? 7-col : col;
                    const rank = this.reversed ? row : 7-row;

                    const pieceImageShortcut = this.pieceImageShortcutAtRankFile(rank, file);
                    if (pieceImageShortcut === null) continue;

                    const image = this.piecesPictures[pieceImageShortcut];
                    const x = this.cellSize * (0.5 + col);
                    const y = this.cellSize * (0.5 + row);

                    canvas.drawBitmap(image, null, createRect(x, y, this.cellSize, this.cellSize), null);
                }
            }
        },
        _drawPlayerTurn(canvas) {
            const paint = new Paint();
            paint.setStyle(Style.FILL);
            paint.setColor(this.turnColor());

            const x = this.cellSize * 8.5;
            canvas.drawArc(createRect(x,x, this.halfCellSize, this.halfCellSize), 360, 360, true, paint);
        },
        _drawMovedPiece(canvas) {
            if (!this.dndActive) return;

            const image = this.dndMovedPieceImage;
            if (image === null) return;

            const x = this.movedPieceLeft();
            const y = this.movedPieceTop();

            canvas.drawBitmap(image, null, createRect(x, y, this.cellSize, this.cellSize), null);
        },
        _drawLastMoveArrow(canvas) {
            if (this.lastMove === undefined) return;

            const realOriginCol = this.reversed ? 7-this.lastMove.origin.file: this.lastMove.origin.file;
            const realOriginRow = this.reversed ? this.lastMove.origin.rank: 7-this.lastMove.origin.rank;

            const realDestCol = this.reversed ? 7 - this.lastMove.dest.file : this.lastMove.dest.file;
            const realDestRow = this.reversed ? this.lastMove.dest.rank : 7-this.lastMove.dest.rank;

            const baseStartX = this.cellSize * (1.0 + realOriginCol);
            const baseStartY = this.cellSize * (1.0 + realOriginRow);
            const baseStopX = this.cellSize * (1.0 + realDestCol);
            const baseStopY = this.cellSize * (1.0 + realDestRow);

            const deltaX = baseStopX - baseStartX;
            const deltaY = baseStopY - baseStartY;
            const baseLineAngleRad = Math.atan2(deltaY, deltaX);
            const edge1AngleRad = baseLineAngleRad + 2.618;
            const edge2AngleRad = baseLineAngleRad + 3.665;

            const edge1StartX = baseStopX;
            const edge1StartY = baseStopY;
            const edge1StopX = baseStopX + this.cellSize * Math.cos(edge1AngleRad) * 0.6;
            const edge1StopY = baseStopY + this.cellSize * Math.sin(edge1AngleRad) * 0.6;
            
            const edge2StartX = baseStopX;
            const edge2StartY = baseStopY;
            const edge2StopX = baseStopX + this.cellSize * Math.cos(edge2AngleRad) * 0.6;
            const edge2StopY = baseStopY + this.cellSize * Math.sin(edge2AngleRad) * 0.6;

            const paint = new Paint();
            paint.setColor(new Color('#22AAFF'));
            paint.setStrokeWidth(this.cellSize * 0.1);
            
            canvas.drawLine(baseStartX, baseStartY, baseStopX, baseStopY, paint);
            canvas.drawLine(edge1StartX, edge1StartY, edge1StopX, edge1StopY, paint);
            canvas.drawLine(edge2StartX, edge2StartY, edge2StopX, edge2StopY, paint);
        },
        _moveStringFromEngineToMoveData(moveStr) {
            const originFile = moveStr.charCodeAt(0) - "a".charCodeAt(0);
            const originRank = moveStr.charCodeAt(1) - "1".charCodeAt(0);
            const destFile = moveStr.charCodeAt(2) - "a".charCodeAt(0);
            const destRank = moveStr.charCodeAt(3) - "1".charCodeAt(0);

            const startCellStr = moveStr.slice(0, 2);
            const endCellStr = moveStr.slice(2, 4);
            
            let promotion = 'q';
            if (moveStr.length >= 5) {
                promotion = moveStr.slice(4, 5);
            } 
            return {
                startCellStr: startCellStr,
                endCellStr: endCellStr,
                origin: {
                    file: originFile,
                    rank: originRank,
                },
                destination: {
                    file: destFile,
                    rank: destRank,
                },
                promotion: promotion,
            };
        },
        _commitComputerMove(moveData) {
            const moveNumber =  parseInt(this.boardLogic.fen().split(" ")[5]);;
            this.boardLogic.move({from: moveData.startCellStr, to: moveData.endCellStr, promotion: moveData.promotion});
            const lastMoveIsWhite = this.boardLogic.turn() === 'b'; 
            const history = this.boardLogic.history();
            let lastMoveSan = history[history.length - 1];
            lastMoveSan = lastMoveSan.replace('K', lastMoveIsWhite ? '\u2654' : '\u265A');
            lastMoveSan = lastMoveSan.replace('Q', lastMoveIsWhite ? '\u2655' : '\u265B');
            lastMoveSan = lastMoveSan.replace('R', lastMoveIsWhite ? '\u2656' : '\u265C');
            lastMoveSan = lastMoveSan.replace('B', lastMoveIsWhite ? '\u2657' : '\u265D');
            lastMoveSan = lastMoveSan.replace('N', lastMoveIsWhite ? '\u2658' : '\u265E');
            this.lastMove = {
                origin: moveData.origin,
                dest: moveData.destination,
            };

            this.playedMoves.push({
                positionFen: this.boardLogic.fen(),
                lastMove: this.lastMove,
            });

            this.$emit('movesan', {
                moveNumber,
                san: lastMoveSan,
                whiteMove: lastMoveIsWhite,
            });
            this.checkGameEndedStateAndNotifyUser();

            const canvas = this.$refs.canvas.nativeView;
            canvas.redraw();

            this.computerIsThinking = false;
            if (this.gameInProgress) this.makeComputerPlayIfComputerTurn();
        }
    },
}
</script>

<style scoped>
    @keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 0.6;
		}
	}

    Label[coordinate] {
        text-align: center;
        vertical-align: middle;
    }

    #promotionDialog {
        opacity: 0;
        visibility: collapse;
    }

    #promotionDialog.opened {
        opacity: 0.6;
        background-color: whitesmoke;
        visibility: visible;
        animation-name: fadeIn;
		animation-duration: 1s;
		animation-fill-mode: forwards;
    }

    #promotionDialog Label {
        color: black;
    }

    #promotionDialog > #title {
        color: black;
    }

    #gameEndedText {
        opacity: 0;
        visibility: collapse;
    }

    #gameEndedText.opened {
        opacity: 0.6;
        visibility: visible;
        animation-name: fadeIn;
        animation-duration: 1s;
        animation-fill-mode: forwards;
    }
</style>
