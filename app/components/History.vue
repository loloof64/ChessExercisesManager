<template>
    <ScrollView ref="scrollview" :width="size" :height="size" backgroundColor="#fdc">
        <WrapLayout orientation="horizontal">
            <template v-for="(child, childIndex) in children">
                <Label v-if="child.type === 'moveNumber'" :key="child.number" :text="child.number"
                    :fontSize="size * 0.075" class="moveNumber"
                />
                <Label v-if="child.type === 'moveSan'" :key="child.san" :text="child.san"
                    :fontSize="size * 0.065" :margin="size * 0.0125" class="moveSan"
                    @tap="() => sendGotoHistoryEvent(childIndex)"
                    :backgroundColor="getMoveBackgroundColor(childIndex)"
                />
            </template>
        </WrapLayout>
    </ScrollView>
</template>

<script>
export default {
    props: {
        size: {
            type: Number,
            default: 200,
        },
    },
    data() {
        return {
            children: [],
            firstSanMove: false,
            childIndex: 0,
            historyIndex: 0,
            hightlightedChildIndex: undefined,
        }
    },
    methods: {
        startHistory({moveNumber, whiteMove}) {
            const white = whiteMove || true;
            const number = moveNumber || 1;

            // clear array content
            this.children.splice(0, this.children.length);

            this.historyIndex = 0;
            this.childIndex = 0;

            const numberStr = `${moveNumber}.${whiteMove ? '' : '..'}`;
            this.children.push({
                type: 'moveNumber',
                number: numberStr,
                childIndex: this.childIndex,
            });
            this.childIndex++;

            this.firstSanMove = true;
            this.hightlightedChildIndex = undefined;
        },
        addSanMove({san, whiteMove, moveNumber}) {
            const white = whiteMove === undefined ? true : whiteMove;

            if (!this.firstSanMove && white) {
                const number = `${moveNumber}.`;
                this.children.push({
                    type: 'moveNumber',
                    number: number,
                    childIndex: this.childIndex,
                });
                this.childIndex++;
            }

            this.children.push({
                type: 'moveSan',
                san: san,
                moveNumber,
                whiteMove,
                childIndex: this.childIndex,
                historyIndex: this.historyIndex,
            });
            this.childIndex++;
            this.historyIndex++;

            this.firstSanMove = false;
            // Move the scrollview to the bottom
            const scrollView = this.$refs.scrollview.nativeView;
            scrollView.scrollToVerticalOffset(scrollView.scrollableHeight, false);
        },
        sendGotoHistoryEvent(childIndex) {
            const historyObject = this.children[childIndex];
            this.childIndex = childIndex;

            if (historyObject.childIndex === undefined) return;

            this.$emit('gotohistory', historyObject.historyIndex);
        },
        highlightHistoryMove(historyIndex) {
            const matchingChild = this.children.find(item => item.historyIndex === historyIndex);
            // Cancel if no matching child
            if (matchingChild === undefined) return;
            this.hightlightedChildIndex = matchingChild.childIndex;
        },
        getMoveBackgroundColor(childIndex) {
            const matchingChild = this.children.find(item => item.childIndex === this.hightlightedChildIndex);
            if (!matchingChild) return 'transparent';
            return matchingChild.childIndex === childIndex ? '#f66' : 'transparent';
        },
        getCurrentHistoryElement() {
            const allSanHistoryElements = this.children.filter(item => item.type === 'moveSan');
            const historyElement = allSanHistoryElements[this.historyIndex];
            return historyElement;
        },
        gotoHistoryIndex(childIndex) {
            if (childIndex === 'first') {
                this.historyIndex = -1;
            }
            else if (childIndex === 'last') {
                const historyLength = this.children.filter(item => item.type === 'moveSan').length;
                this.historyIndex = historyLength - 1;
            }
            else if (childIndex === 'previous') {
                this.historyIndex -= 1;
            }
            else if (childIndex === 'next') {
                this.historyIndex += 1;
            }
            else {
                this.historyIndex = childIndex;
            }
            const matchingChild = this.children.find(item => item.historyIndex === this.historyIndex);
            this.childIndex = matchingChild ? matchingChild.childIndex : undefined;
            this.hightlightedChildIndex = this.childIndex;
        }
    },
}
</script>

<style scoped>
    Label.moveNumber {
        vertical-align: middle;
        font-weight: bold;
    }
    Label.moveSan {
        color: cadetblue;
    }
</style>