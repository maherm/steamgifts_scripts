// ==UserScript==
// @name         SG Add IsThereAnyDeal Data
// @namespace    http://steamgifts.com/
// @version      0.2
// @description  Adds a link to IsThereAnyDeal on the GA page and fetches the current best price and the bundles from itad.com
// @author       mh
// @downloadURL  https://raw.githubusercontent.com/maherm/steamgifts_scripts/master/sg_add_isthereanydeal_data.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.3/jquery.min.js
// @require      http://momentjs.com/downloads/moment.min.js
// @include      http*://www.steamgifts.com/giveaway/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

/*jshint multistr: true */

var enable_loadLowestPrice = true;
var enable_loadBundleInfos = true;

(function() {
    'use strict';

    function loadIsThereAnyDealInfos(encodedTitle, $newLine, $pricesNavSection){
        if(!enable_loadLowestPrice)
            return "";
        var url = "https://isthereanydeal.com/ajax/game/info?plain="+encodedTitle;
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            onload: function(response) {
                var $html = $(response.responseText);

                //Check for edge cases
                if($html.find(".pageError:contains(This game has been merged with)").length > 0){
                    var newUrl = $html.find(".pageError:contains(This game has been merged with) a").attr("href");
                    var newEncodedName = newUrl.split("=").pop();
                    loadIsThereAnyDealInfos(newEncodedName, $newLine, $pricesNavSection);
                    return;
                }

                //Load lowest price
                if(enable_loadLowestPrice){
                    var $prices = $html.find(".new.right");
                    if($prices.length > 0){
                        var currentBestPrice = Math.min.apply(null,$prices.map(function(idx, el){return Number($(el).text().replace(/[^0-9,.]/g,'').replace(",","."));}));
                        var currency = $prices.first().text().replace(/[0-9,.]/g,'').replace(/€/g, "EUR").replace(/\$/g,"USD");
                        var priceHtml = "<div class='sidebar__navigation__item__count'>"+currentBestPrice.toFixed(2)+" "+currency +"</div>";
                        $newLine.find("a.isthereanydeal_link").append(priceHtml);
                    }
                }

                //Load list of bundles
                if(enable_loadBundleInfos){
                   var $bundleSection = createNewSection($pricesNavSection, "Bundles", "bundles_section");
                    var $bundles = $html.find(".bundle-container:has(.bundleTagContent:contains(Bundle)) .bundle-head");
                    var bundlesExist = false;
                    $bundles.each(function(idx, el){
                        var $el = $(el);
                        var $title = $el.find(".bundle-title");
                        var $time = $el.find(".bundle-time");

                        //Collect data
                        var shopName = $title.find(".shopTitle").text();
                        $title.find("span").remove(); //remove the "by [Shop Name]"
                        var title = $title.text();
                        var url = "https://isthereanydeal.com"+ $title.find("a").attr("href");
                        var className = $time.hasClass("expired") ? "expired" : "";
                        var time = $time.attr("title");
                        if(time) //"Unknown expiry" has no time in the title attribute
                            time = moment(time).fromNow();
                        else
                            time = "Active";

                        //Build HTML
                        var titleHtml = "<span class='bundleTitle'>"+title+"</span><span class='bundleShop'>"+shopName+"</span>";
                        var $bundleLine = createNewLine(titleHtml, url, className, time);
                        $bundleSection.append($bundleLine);
                        bundlesExist = true;
                    });
                    if(!bundlesExist)
                        $bundleSection.append(createNewLine("This game was never bundled", undefined, "expired", undefined, true));
                }
            }
        });

    }

    function romanize (num) {
        var key = ["","i","ii","iii","iv","v","vi","vii","viii","ix"];
        return key[Number(num)];
    }

    function encodeName(str){
        str = str.toLowerCase(); //lowercase
        str = str.replace(/[1-9]/g, romanize);//romanize digits
        str = str.replace(/(^the[^a-z])|([^a-z]the[^a-z])|([^a-z]the$)/g, ""); //remove "the", but not e.g. "other" or "them"
        str = str.replace(/\+/g, "plus");    //spell out "plus"
        str = str.replace(/\&/g, "and");    //spell out "and"
        str = str.replace(/[^a-z0]/g, '');    //remove remaining invalid characters, like spaces, braces, hyphens etc
        return str;
    }

    function createNewSection($addAfter, name, className){
        var $title = $("<h3 class='sidebar__heading "+className+"'>"+name+"</h3>");
        var $body = $("<ul class='sidebar__navigation "+className+"'></ul>");
        $addAfter.after($title);
        $title.after($body);
        return $body;
    }

    function createNewLine(name, url, className, price, dontDrawLine){
        price = price ? "<div class='sidebar__navigation__item__count'>"+price+"</div>"  : "";
        url = url ? "href='"+url+"'" : "";
        className = className || "";
        var underline = dontDrawLine ? "" : "<div class='sidebar__navigation__item__underline'></div>";
        return $("<li class='sidebar__navigation__item'><a class='sidebar__navigation__item__link "+className+"' "+url+" rel='nofollow' target='_blank'><div class='sidebar__navigation__item__name'>"+name+"</div>"+underline+price+"</a></li>");
    }

    /* =========================== for compatibility with the "AutoExplore Train" script ===================== */
    var GM_getValue = function(key, def) {
        return localStorage[key] || def;
    };
    var GM_setValue = function(key, value) {
        localStorage[key] = value;
    };

    function setAutoExplore(val){
        GM_setValue("auto_explore_active", val);
    }

    function parseBool(value){
        if(value === "true" || value === true)
            return true;
        return false;
    }

    function isAutoExplore(){
        var str = GM_getValue("auto_explore_active", false);
        var result = parseBool(str);
        return result;
    }

    if(isAutoExplore()){
        enable_loadLowestPrice = false;
        enable_loadBundleInfos = false;
    }

    /* =========================== / for compatibility with the "AutoExplore Train" script ===================== */

    function main(){
        injectCss();

        //Get full game title from the document title
        var title = document.title;
        var urlParts = document.URL.split("/");
        if(urlParts.length > 6) //If we are at a subpage, eg "/entries", we need to remove that appendix from the title
            title = title.substring(0, title.lastIndexOf("-"));

        //Convert the title to isthereanydeal's strange uri syntax
        var encodedTitle = encodeName(title);

        //Build URL
        var url = "https://isthereanydeal.com/#/page:game/info?plain="+encodedTitle;

        //Add Link to navbar
        var $pricesSection = $(".sidebar__navigation").last();

        var $newLine = createNewLine("IsThereAnyDeal", url, "isthereanydeal_link");
        loadIsThereAnyDealInfos(encodedTitle, $newLine, $pricesSection);
        $pricesSection.append($newLine);
    }

    function injectCss(){
        $("head").append (
		'<style> \
			   a.sidebar__navigation__item__link.expired *{\
				color: #aeafaf;\
			}\
			\
			a.sidebar__navigation__item__link span.bundleShop{\
				font-size: 6pt;\
				padding-left: 5px;\
				color: #B287AF;\
			}\
			.sidebar__navigation__item__name{ \
				max-width: 250px; \
			}\
		</style>'
        );
    }
    main();
})();