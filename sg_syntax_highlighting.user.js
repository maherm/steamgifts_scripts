// ==UserScript==
// @name         SG Syntax Highlighting
// @namespace    https://www.steamgifts.com/user/mahermen
// @version      0.2
// @description  Highlights source code
// @require      https://code.jquery.com/jquery-3.1.1.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/SyntaxHighlighter/3.0.83/scripts/shCore.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/SyntaxHighlighter/3.0.83/scripts/shBrushJScript.min.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.6/sgapi.js
// @resource     coreMin https://cdnjs.cloudflare.com/ajax/libs/SyntaxHighlighter/3.0.83/styles/shCore.min.css
// @resource     themeDefault https://cdnjs.cloudflare.com/ajax/libs/SyntaxHighlighter/3.0.83/styles/shThemeDefault.min.css
// @author       mahermen
// @match        https://www.steamgifts.com/discussion/*
// @grant        GM_getResourceText
// ==/UserScript==

SgApi.Util.requireDeclaredStyles();
SgApi.Util.injectCss(".syntaxhighlighter { overflow-y: hidden !important;padding-top: 8px!important;padding-bottom: 8px!important; }");

$("pre code").each(function(i, block) {
    $(block).parent().addClass($(block).attr("class").replace("language-","toolbar:false; brush: ")).text($(block).text());
});

SyntaxHighlighter.all();
