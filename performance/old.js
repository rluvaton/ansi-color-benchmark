"use strict";


const prettyBytes = require("pretty-bytes");

function parseAnsi(textInput) {
    "use strict";

    /*  ------------------------------------------------------------------------ */

    const O = Object

    /*  See https://misc.flogisoft.com/bash/tip_colors_and_formatting
        ------------------------------------------------------------------------ */

    const colorCodes      = [   'black',      'red',      'green',      'yellow',      'blue',      'magenta',      'cyan', 'lightGray', '', 'default']
        , colorCodesLight = ['darkGray', 'lightRed', 'lightGreen', 'lightYellow', 'lightBlue', 'lightMagenta', 'lightCyan', 'white', '']

        , styleCodes = ['', 'bright', 'dim', 'italic', 'underline', '', '', 'inverse']

        , asBright = { 'red':       'lightRed',
        'green':     'lightGreen',
        'yellow':    'lightYellow',
        'blue':      'lightBlue',
        'magenta':   'lightMagenta',
        'cyan':      'lightCyan',
        'black':     'darkGray',
        'lightGray': 'white' }

        , types = { 0:  'style',
        2:  'unstyle',
        3:  'color',
        9:  'colorLight',
        4:  'bgColor',
        10: 'bgColorLight' }

        , subtypes = {  color:         colorCodes,
        colorLight:    colorCodesLight,
        bgColor:       colorCodes,
        bgColorLight:  colorCodesLight,
        style:         styleCodes,
        unstyle:       styleCodes    }

    /*  ------------------------------------------------------------------------ */

    const clean = obj => {
        for (const k in obj) { if (!obj[k]) { delete obj[k] } }
        return (O.keys (obj).length === 0) ? undefined : obj
    }

    /*  ------------------------------------------------------------------------ */

    class Color {

        constructor (background, name, brightness) {

            this.background = background
            this.name       = name
            this.brightness = brightness
        }

        get inverse () {
            return new Color (!this.background, this.name || (this.background ? 'black' : 'white'), this.brightness)
        }

        get clean () {
            return clean ({ name:   this.name === 'default' ? '' : this.name,
                bright: this.brightness === Code.bright,
                dim:    this.brightness === Code.dim })
        }

        defaultBrightness (value) {

            return new Color (this.background, this.name, this.brightness || value)
        }

        css (inverted) {

            const color = inverted ? this.inverse : this

            const rgbName = ((color.brightness === Code.bright) && asBright[color.name]) || color.name

            const prop = (color.background ? 'background:' : 'color:')
                , rgb  = Colors.rgb[rgbName]
                , alpha = (this.brightness === Code.dim) ? 0.5 : 1

            return rgb
                ? (prop + 'rgba(' + [...rgb, alpha].join (',') + ');')
                : ((!color.background && (alpha < 1)) ? 'color:rgba(0,0,0,0.5);' : '') // Chrome does not support 'opacity' property...
        }
    }

    /*  ------------------------------------------------------------------------ */

    class Code {

        constructor (n) {
            if (n !== undefined) { this.value = Number (n) } }

        get type () {
            return types[Math.floor (this.value / 10)] }

        get subtype () {
            return subtypes[this.type][this.value % 10] }

        get str () {
            return (this.value ? ('\u001b\[' + this.value + 'm') : '') }

        static str (x) {
            return new Code (x).str }

        get isBrightness () {
            return (this.value === Code.noBrightness) || (this.value === Code.bright) || (this.value === Code.dim) }
    }

    /*  ------------------------------------------------------------------------ */

    O.assign (Code, {

        reset:        0,
        bright:       1,
        dim:          2,
        inverse:      7,
        noBrightness: 22,
        noItalic:     23,
        noUnderline:  24,
        noInverse:    27,
        noColor:      39,
        noBgColor:    49
    })

    /*  ------------------------------------------------------------------------ */

    const replaceAll = (str, a, b) => str.split (a).join (b)

    /*  ANSI brightness codes do not overlap, e.g. "{bright}{dim}foo" will be rendered bright (not dim).
        So we fix it by adding brightness canceling before each brightness code, so the former example gets
        converted to "{noBrightness}{bright}{noBrightness}{dim}foo" – this way it gets rendered as expected.
     */

    const denormalizeBrightness = s => s.replace (/(\u001b\[(1|2)m)/g, '\u001b[22m$1')
    const normalizeBrightness = s => s.replace (/\u001b\[22m(\u001b\[(1|2)m)/g, '$1')

    const wrap = (x, openCode, closeCode) => {

        const open  = Code.str (openCode),
            close = Code.str (closeCode)

        return String (x)
            .split ('\n')
            .map (line => denormalizeBrightness (open + replaceAll (normalizeBrightness (line), close, open) + close))
            .join ('\n')
    }

    /*  ------------------------------------------------------------------------ */

    const camel = (a, b) => a + b.charAt (0).toUpperCase () + b.slice (1)


    const stringWrappingMethods = (() => [

            ...colorCodes.map ((k, i) => !k ? [] : [ // color methods

                [k,               30 + i, Code.noColor],
                [camel ('bg', k), 40 + i, Code.noBgColor],
            ]),

            ...colorCodesLight.map ((k, i) => !k ? [] : [ // light color methods

                [k,                90 + i, Code.noColor],
                [camel ('bg', k), 100 + i, Code.noBgColor],
            ]),

            /* THIS ONE IS FOR BACKWARDS COMPATIBILITY WITH PREVIOUS VERSIONS (had 'bright' instead of 'light' for backgrounds)
             */
            ...['', 'BrightRed', 'BrightGreen', 'BrightYellow', 'BrightBlue', 'BrightMagenta', 'BrightCyan'].map ((k, i) => !k ? [] : [

                ['bg' + k, 100 + i, Code.noBgColor],
            ]),

            ...styleCodes.map ((k, i) => !k ? [] : [ // style methods

                [k, i, ((k === 'bright') || (k === 'dim')) ? Code.noBrightness : (20 + i)]
            ])
        ]
            .reduce ((a, b) => a.concat (b))

    ) ();

    /*  ------------------------------------------------------------------------ */

    const assignStringWrappingAPI = (target, wrapBefore = target) =>

        stringWrappingMethods.reduce ((memo, [k, open, close]) =>
                O.defineProperty (memo, k, {
                    get: () => assignStringWrappingAPI (str => wrapBefore (wrap (str, open, close)))
                }),

            target)

    /*  ------------------------------------------------------------------------ */

    const TEXT    = 0,
        BRACKET = 1,
        CODE    = 2

    class Span {
        // Those are added in the actual parse, this is done for performance reasons to have the same hidden class
        css = "";
        color = "";
        bgColor = "";
        bold = undefined;

        constructor(code, text) {
            this.code = code;
            this.text = text;
        }
    }

// getString as function instead of string to allow garbage collection
    function* rawAnsiParse(getString) {
        const stateObject = {
            state: TEXT,
            buffer: "",
            text: "",
            code: "",
            codes: [],
        };

        const chunks = splitStringToChunksOfSize(
            typeof getString === 'function' ? getString() : getString,
            // 1 MB
            1_048_576
        );

        while (chunks.length > 0) {
            const chunk = chunks.shift();
            yield* processChunk(chunk, stateObject);

            // if(i%10000 === 0) {
                printMemory();
            // }
        }

        if (stateObject.state !== TEXT) stateObject.text += stateObject.buffer;

        if (stateObject.text) {
            yield new Span(new Code(), stateObject.text);
        }
    }

    function splitStringToChunksOfSize(str, chunkSize) {
        const chunks = [];
        const chunksLength = Math.ceil(str.length / chunkSize);

        for (let i = 0, o = 0; i < chunksLength; ++i, o += chunkSize) {
            chunks.push(str.substring(o, o + chunkSize));
        }

        return chunks;
    }

    function* processChunk(chunk, stateObject) {
        const chars = chunk;
        const charsLength = chunk.length;

        for (let i = 0; i < charsLength; i++) {
            const c = chars[i];

            stateObject.buffer += c;

            switch (stateObject.state) {
                case TEXT:
                    if (c === "\u001b") {
                        stateObject.state = BRACKET;
                        stateObject.buffer = c;
                    } else {
                        stateObject.text += c;
                    }
                    break;

                case BRACKET:
                    if (c === "[") {
                        stateObject.state = CODE;
                        stateObject.code = "";
                        stateObject.codes = [];
                    } else {
                        stateObject.state = TEXT;
                        stateObject.text += stateObject.buffer;
                    }
                    break;

                case CODE:
                    if (c >= "0" && c <= "9") {
                        stateObject.code += c;
                    } else if (c === ";") {
                        stateObject.codes.push(new Code(stateObject.code));
                        stateObject.code = "";
                    } else if (c === "m") {
                        stateObject.code = stateObject.code || "0";
                        for (const code of stateObject.codes) {
                            yield new Span(code, stateObject.text);
                            stateObject.text = "";
                        }

                        yield new Span(new Code(stateObject.code), stateObject.text);
                        stateObject.text = "";
                        stateObject.state = TEXT;
                    } else {
                        stateObject.state = TEXT;
                        stateObject.text += stateObject.buffer;
                    }
            }
        }
    }

    /*  ------------------------------------------------------------------------ */

    /**
     * Represents an ANSI-escaped string.
     */
    class Colors {

        /**
         * @param {string} s a string containing ANSI escape codes.
         */
        constructor (s) {
            this.spans = s ? Array.from(rawAnsiParse(s)) : []
        }

        get str () {
            return this.spans.reduce ((str, p) => str + p.text + p.code.str, '')
        }

        get parsed () {

            let color, bgColor, brightness, styles

            function reset () {

                color      = new Color (),
                    bgColor    = new Color (true /* background */),
                    brightness = undefined,
                    styles     = new Set ()
            }

            reset ()

            const newColors = new Colors()
            const newSpans = newColors.spans

            for (const span of this.spans) {
                const c = span.code;

                const inverted = styles.has("inverse"),
                    underline = styles.has("underline")
                        ? "text-decoration: underline;"
                        : "",
                    italic = styles.has("italic") ? "font-style: italic;" : "",
                    bold = brightness === Code.bright ? "font-weight: bold;" : "";

                const foreColor = color.defaultBrightness(brightness);

                const styledSpan = O.assign(
                    {
                        css:
                            bold +
                            italic +
                            underline +
                            foreColor.css(inverted) +
                            bgColor.css(inverted),
                    },
                    clean({
                        bold: !!bold,
                        color: foreColor.clean,
                        bgColor: bgColor.clean,
                    }),
                    span
                );

                for (const k of styles) {
                    styledSpan[k] = true;
                }

                if (c.isBrightness) {
                    brightness = c.value;
                } else if (span.code.value !== undefined) {
                    if (span.code.value === Code.reset) {
                        reset();
                    } else {
                        switch (span.code.type) {
                            case "color":
                            case "colorLight":
                                color = new Color(false, c.subtype);
                                break;

                            case "bgColor":
                            case "bgColorLight":
                                bgColor = new Color(true, c.subtype);
                                break;

                            case "style":
                                styles.add(c.subtype);
                                break;
                            case "unstyle":
                                styles.delete(c.subtype);
                                break;
                        }
                    }
                }

                if(styledSpan.text.length > 0)
                    newSpans.push(styledSpan);
            }

            return newColors
        }

        /*  Outputs with Chrome DevTools-compatible format     */

        get asChromeConsoleLogArguments () {

            const spans = this.parsed.spans

            return [spans.map (s => ('%c' + s.text)).join (''),
                ...spans.map (s => s.css)]
        }

        get browserConsoleArguments () /* LEGACY, DEPRECATED */ { return this.asChromeConsoleLogArguments }

        /**
         * @desc installs String prototype extensions
         * @example
         * require ('ansicolor').nice
         * console.log ('foo'.bright.red)
         */
        static get nice () {

            Colors.names.forEach (k => {
                if (!(k in String.prototype)) {
                    O.defineProperty (String.prototype, k, { get: function () { return Colors[k] (this) } })
                }
            })

            return Colors
        }

        /**
         * @desc parses a string containing ANSI escape codes
         * @return {Colors} parsed representation.
         */
        static parse (s) {
            return new Colors (s).parsed
        }

        /**
         * @desc strips ANSI codes from a string
         * @param {string} s a string containing ANSI escape codes.
         * @return {string} clean string.
         */
        static strip (s) {
            return s.replace (/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-PRZcf-nqry=><]/g, '') // hope V8 caches the regexp
        }

        /**
         * @desc checks if a value contains ANSI escape codes
         * @param {any} s value to check
         * @return {boolean} has codes
         */
        static isEscaped (s) {
            s = String(s)
            return Colors.strip (s) !== s;
        }

        /**
         * @example
         * const spans = [...ansi.parse ('\u001b[7m\u001b[7mfoo\u001b[7mbar\u001b[27m')]
         */
        [Symbol.iterator] () {
            return this.spans[Symbol.iterator] ()
        }

        /**
         * @desc This allows an alternative import style, see https://github.com/xpl/ansicolor/issues/7#issuecomment-578923578
         * @example
         * import { ansicolor, ParsedSpan } from 'ansicolor'
         */
        static get ansicolor () {
            return Colors
        }
    }

    /*  ------------------------------------------------------------------------ */

    assignStringWrappingAPI (Colors, str => str)

    /*  ------------------------------------------------------------------------ */

    Colors.names = stringWrappingMethods.map (([k]) => k)

    /*  ------------------------------------------------------------------------ */

    Colors.rgb = {

        black:        [0,     0,   0],
        darkGray:     [100, 100, 100],
        lightGray:    [200, 200, 200],
        white:        [255, 255, 255],

        red:          [204,   0,   0],
        lightRed:     [255,  51,   0],

        green:        [0,   204,   0],
        lightGreen:   [51,  204,  51],

        yellow:       [204, 102,   0],
        lightYellow:  [255, 153,  51],

        blue:         [0,     0, 255],
        lightBlue:    [26,  140, 255],

        magenta:      [204,   0, 204],
        lightMagenta: [255,   0, 255],

        cyan:         [0,   153, 255],
        lightCyan:    [0,   204, 255],
    }

    /*  ------------------------------------------------------------------------ */

    module.exports = Colors

    /*  ------------------------------------------------------------------------ */



    return Colors.parse(textInput).spans;
}

function printMemory() {
    console.log(
        Object.fromEntries(
            Object.entries(process.memoryUsage())
                .map(([key, value]) => [key, prettyBytes(value)])
        )
    )

}

module.exports = {parseAnsi}

