// ==UserScript==
// @name         SG Add IsThereAnyDeal Data
// @namespace    http://steamgifts.com/
// @version      0.17
// @description  Adds a link to IsThereAnyDeal on the GA page and fetches the current best price and the bundles from itad.com
// @author       mh
// @downloadURL  https://raw.githubusercontent.com/maherm/steamgifts_scripts/master/sg_add_isthereanydeal_data.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.3/jquery.min.js
// @require      http://momentjs.com/downloads/moment.min.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.7/sgapi.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.7/sgapi_gatools.js
// @resource     css https://raw.githubusercontent.com/maherm/steamgifts_scripts/9edf74/sg_add_isthereanydeal_data.css
// @include      http*://www.steamgifts.com/giveaway/*
// @grant        GM_xmlhttpRequest
// @grant        GM_getResourceText
// @connect      isthereanydeal.com
// ==/UserScript==

/*jshint multistr: true */
(function() {
    'use strict';

    var enable_loadLowestPrice = true;
    var enable_loadBundleInfos = true;
	var staticReplacements = {
        "storiesofbethemfullmoon":"storiesofbethemfullmoonedition",
        "feariireborndlc":"feariireborn",
		"justcauseiiixl":"justcauseiiixledition",
		"gabrielknightsinsoffather":"gabrielknightsinsoffathers"
    };

    function main(){
        SgApi.Util.requireDeclaredStyles();

        //Get full game title from the document title
        var title = SgApi.Giveaways.currentGiveaway().gameTitle;

        //Convert the title to isthereanydeal's strange uri syntax
        var encodedTitle = encodeName(title);

        //Build URL
        var url = "https://isthereanydeal.com/game/"+encodedTitle+"/info/";

        //Add Link to navbar
        var $pricesSection = $(".sidebar__navigation").last();

        var $newLine = createNewLine("IsThereAnyDeal", url, "isthereanydeal_link");
        loadIsThereAnyDealInfos(encodedTitle, $newLine, $pricesSection);
        $pricesSection.append($newLine);
    }

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
                    var $prices = $html.find(".priceTable tr td.t-st3__num+td.t-st3__price");
                    if($prices.length > 0){
                        var currentBestPrice = Math.min.apply(null,$prices.map(function(idx, el){return Number($(el).text().replace(/p\.$/,'').replace(/[^0-9,.]/g,'').replace(",","."));}));
                        var currency = $prices.first().text().replace(/[0-9,.]/g,'').replace(/€/g, "EUR").replace(/\$/g,"USD");
                        var priceHtml = "<div class='sidebar__navigation__item__count'>"+currentBestPrice.toFixed(2)+" "+currency +"</div>";
                        $newLine.find("a.isthereanydeal_link").append(priceHtml);
                    }
                }

                //Load list of bundles
                if(enable_loadBundleInfos){
                   var $bundleSection = createNewSection($pricesNavSection, "Bundles", "bundles_section");
                    var $bundles = $html.find("table.bundleTable tr:has(td.bundleTable__title)");
                    var bundlesExist = false;
                    $bundles.each(function(idx, el){
                        var $el = $(el);
                        var $title = $el.find(".bundleTable__title");
                        var $time = $el.find(".bundleTable__expiry");
                        var $shop = $el.find(".shopTitle");

                        //Collect data
                        var shopName = $shop.text();
                        var title = $title.text();
                        var url = "https://isthereanydeal.com"+ $title.find("a").attr("href");
                        var isExpired = $time.hasClass("bundleTable__expiry--expired");
                        var className = isExpired ? "expired" : "";
                        var time = $time.attr("title");
                        if(time) //"Unknown expiry" has no time in the title attribute
                            time = moment(time, "YYYY-MM-DD HH:mm 'GMT'").fromNow();
                        else
                            time =  isExpired? "Expired" : $time.text();

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
        // str = str.replace(/[1-9]/g, romanize); // Don't romanize digits. (Therefore commented out.)
        str = str.replace(/(^the[^a-z])|([^a-z]the[^a-z])|([^a-z]the$)/g, ""); //remove "the", but not e.g. "other" or "them"
        str = str.replace(/\+/g, "plus");    //spell out "plus"
        str = str.replace(/\&/g, "and");    //spell out "and"
        str = str.replace(/ /g, "-");         // Replace spaces with a dash.
        str = str.replace(/[^a-z0-9-]/g, ''); // Remove all characters apart from letters, digits and dash.
        return staticReplacements[str] || str;
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

    main();
})();
