import {createElement} from "react"
import {expect,it} from "vitest"
import {renderToStaticMarkup} from "react-dom/server"
import {MarkdownDocument} from "./markdown-document"
it("renders headings, tables, checklists and code as an artifact document",()=>{const html=renderToStaticMarkup(createElement(MarkdownDocument,{content:'# Brief\n\n| Task | Owner |\n| --- | --- |\n| Plan | Team |\n\n- [ ] Review\n\n```js\nconst x = 1\n```'}));expect(html).toContain("<h1");expect(html).toContain("<table");expect(html).toContain("checkbox");expect(html).toContain("<pre");expect(html).toContain("const x = 1")})
it("does not execute embedded HTML or unsafe links",()=>{const html=renderToStaticMarkup(createElement(MarkdownDocument,{content:'<script>alert(1)</script>\n\n[Bad](javascript:alert%281%29)\n\n<img src=x onerror=alert(1) />'}));expect(html).not.toContain("<script");expect(html).not.toContain("javascript:");expect(html).not.toContain("onerror")})
it("renders image references as explicit links rather than automatic remote loads",()=>{const html=renderToStaticMarkup(createElement(MarkdownDocument,{content:'![Diagram](https://example.com/image.png)'}));expect(html).not.toContain("<img");expect(html).toContain("Open image: Diagram")})
