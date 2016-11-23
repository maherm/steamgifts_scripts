// ==UserScript==
// @name         SG Bookmarks
// @namespace    http://steamgifts.com/
// @version      0.3
// @description  Bookmark giveaways
// @author       mahermen
// @downloadURL  https://github.com/maherm/steamgifts_scripts/raw/master/sg_bookmarks.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/2.2.3/jquery.min.js
// @require      http://momentjs.com/downloads/moment.min.js
// @include      http*://www.steamgifts.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_addStyle
// ==/UserScript==

/*jshint multistr: true */

(function() {
    'use strict';
    var $_ = jQuery.noConflict();

    function parseBool(value){
        if(value === "true" || value === true)
            return true;
        return false;
    }

    function updateMenuButtonState(){
        var $button = $_('.__mh_bookmark_button');
        var $dropdown = $button.find(".nav__relative-dropdown");
        if($dropdown.hasClass("is-hidden")){
            $button.removeClass("nav__button-container--active").addClass("nav__button-container--inactive");
        }
    }

    function toggleBookmarkContainer(e){
        var  $t=$_(this);
        setTimeout(function(){
                $t.addClass("nav__button-container--active").find(".nav__relative-dropdown").removeClass("is-hidden");
        },0);
    }

    function addBookmarkMenuItem(title,descr,url,imgUrl,hasEnded){
         var $html = $_('<a class="nav__row"></a>');
         if(hasEnded)
             $html.addClass(" __mh_ended");
        if(url)
            $html.attr("href",url);
        if(imgUrl)
            $html.append('<img class="__mh_nav_row_img" src="'+imgUrl+'">');
        var $div = $_('<div class="nav__row__summary">');
        var $titleP = $_('<p class="nav__row__summary__name">'+(title?title:"")+'</p>');
        var $descrP = $_('<p class="nav__row__summary__description">'+(descr?descr:'')+'</p>');
        $div.append($titleP);
        $div.append($descrP);
        $html.append($div);
       $_(".__mh_bookmark_container").append($html);
    }

   function addNavRow(bookmarkData){
       var title = bookmarkData.gameTitle;
       var steamId = bookmarkData.steamId;
       var id = bookmarkData.id;
       var url = getGiveawayUrl(id);
       var creator = bookmarkData.creator;
       var ends = bookmarkData.endTime;
       var cp = bookmarkData.cp;
       var imgUrl = getThumbUrl(steamId);
       var endsAt = moment.unix(ends);
       var hasEnded = endsAt.isBefore(moment());
       title = title+ " ("+cp+"P)";
       var endsStr = hasEnded ? "ended" : "ends";
       var descr = "by "+creator+" - "+endsStr+" "+endsAt.fromNow();
       addBookmarkMenuItem(title,descr,url,imgUrl,hasEnded);
   }

    function clearNavRows(){
        $_(".__mh_bookmark_container").empty();
    }
    function buildNavRows(){
        clearNavRows();
        var lst = bookmarkList();
        if(lst.length > 0)
            $_.each(bookmarkList(),function(i,e){addNavRow(e);});
        else
            addBookmarkMenuItem("<div class='nav__row__summary__name __mh_no_bookmarks'>No bookmarks</div>",false,false,"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

    }

   function addNavButton(){
        var $html = $_('<div class="nav__button-container nav__button-container--notification __mh_bookmark_button"> \
								<a class="nav__button"><i class="fa fa-bookmark"></i></a>\
<div class="nav__relative-dropdown is-hidden"><div class="nav__absolute-dropdown __mh_bookmark_container">\
</div></div></div>');
        //var currentStateClass = isAutoExplore() ? "nav__button-container--active" : "nav__button-container--inactive";
        //$html.addClass(currentStateClass);
        $html.attr("title", "Bookmarked Giveaways");
        $html.on("click.bookmark",toggleBookmarkContainer);
        $_(".nav__right-container").prepend($html);
        $_(document).on("click.bookmark",function(){setTimeout(updateMenuButtonState,0);});
       buildNavRows();
    }

    function toggleBookmarkCurrentPage(){
        toggleBookmark(getCurrentId());
        updateButtonState();
    }

    function getCurrentId(){
        return extractId(getCurrentUrl());
    }

    function amIBookmarked(){
        return isBookmarked(getCurrentId());
    }

    function isBookmarked(id){
        return data.bookmarks[id] !== undefined;
    }
    function updateButtonState(){
        var $faIcon = $_(".__mh_bookmarked_icon");
        var isBookmarked = amIBookmarked();
        var css = "fa fa-bookmark" + (isBookmarked ? "" :"-o");
        var title = isBookmarked ? "Clear bookmark for this giveaway" : "Bookmark this Giveaway";
        $faIcon.removeClass("fa-bookmark fa-bookmark-o");
        $faIcon.addClass(css);
        $faIcon.attr("title",title);
    }
    function showButton(){
        var $ci =getContextInfoContainer();
        var $bookmarkBtn = $_("<a><i class='__mh_bookmarked_icon'></i></a>");
        $bookmarkBtn.click(toggleBookmarkCurrentPage);
        $ci.append($bookmarkBtn);
        updateButtonState();
    }
    function getContextInfoContainer(){
        var ciClass="__mh_ci";
        var $ci = $_("."+ciClass);
        if($ci.length===0){
            $ci = $_("<span class='"+ciClass+"'></span>");
            $ci.insertAfter($_(".featured__heading__small"));
        }
        return $ci;
    }

    function getCurrentUrl(){
        return document.URL;
    }

    function isGiveawayPage(){
        return getCurrentUrl().indexOf("https://www.steamgifts.com/giveaway/") === 0;
    }

    var gaUrlRe = /^https?:\/\/(www)?\.steamgifts\.com\/giveaway\/([\w\d]{5})\/.*$/;
    var gaIdRe = /^([\w\d]{5})$/;
    function extractId(url){
        if(url.match(gaIdRe) !== null)
            return url; //already Id String
        return url.match(gaUrlRe)[2];
    }
    function getCurrentCp(){
        var cpStr = $_(".featured__heading__small").last().text();
        return cpStr.substring(1, cpStr.length-2);
    }

    function getCurrentGameTitle(){
        var title = document.title;
        var urlParts = document.URL.split("/");
        if(urlParts.length > 6) //If we are at a subpage, eg "/entries", we need to remove that appendix from the title
            title = title.substring(0, title.lastIndexOf("-"));
        return title;
    }
    function getGaCreator(){
        return $_(".featured__column.featured__column--width-fill.text-right a[href]");
    }
    function getCurrentGaCreatorName(){
        return getGaCreator().text();
    }

    var steamIdRe= /store\.steampowered\.com\/(app|sub)\/(\d+)\//;
    function getSteamId(){
        return $_(".global__image-outer-wrap.global__image-outer-wrap--game-large").attr("href").match(steamIdRe)[2];
    }

    function getCurrentGameThumb(){
        return getGameThumb(getSteamId());
    }

    function getEndTime(){
        return $_(".featured__column:first-child span").attr("data-timestamp");
    }

    function getGiveawayUrl(id){
        return "https://www.steamgifts.com/giveaway/"+id+"/";
    }

    function getThumbUrl(steamId){
        return "https://steamcdn-a.akamaihd.net/steam/apps/"+steamId+"/capsule_184x69.jpg";
    }

    function readCurrentData(){
        return {
            id: getCurrentId(),
            type: "giveaway",
            cp: getCurrentCp(),
            gameTitle: getCurrentGameTitle(),
            creator: getCurrentGaCreatorName(),
            steamId: getSteamId(),
            endTime: getEndTime()
        };
    }

    function saveData(){
         GM_setValue("__mh_bookmarks", data);
    }

    function clearBookmark(gaId){
       delete data.bookmarks[gaId];
       saveData();
    }

    function saveBookmark(gaId, bookmarkData){
        data.bookmarks[gaId] = bookmarkData;
        saveData();
    }

    function toggleBookmark(gaId){
        readBookmarks();
        if(isBookmarked(gaId))
            clearBookmark(gaId);
        else
            saveBookmark(gaId, readCurrentData());
        buildNavRows();
    }

    var data;
    function readBookmarks(){
        data = GM_getValue("__mh_bookmarks", new Data());
        data = $_.extend( {},new Data(),data);
        data.settings = $_.extend( {},new Settings(),data.settings);
        console.log(data);
    }
    function main(){
        //GM_deleteValue("__mh_bookmarks");
        injectCss();
        readBookmarks();
        if(isGiveawayPage()){
           showButton();
        }
       addNavButton();
    }

    function bookmarkList(){
        var lst =[];
        for(var k in data.bookmarks){
            lst.push(data.bookmarks[k]);
        }
        lst.sort(function(a,b){
            var now = moment().unix();
            var adiff = now-a.endTime;
            var bdiff = now-b.endTime;
            var r1= a.endTime - b.endTime;
            if(adiff > 0 || bdiff > 0)
                return b.endTime-a.endTime;
            return bdiff -adiff;
        });
        return lst;
    }

    function Settings(){
        this.sortByEndDate=true;
    }
    function Data(){
        var that = this;
        this.bookmarks = {};
        this.settings = new Settings();
    }

     main();

function injectCss(){
    /*jshint multistr: true */
 GM_addStyle('.__mh_ci>a:not(:first-child){\
margin-left: 10px;\
}\
.__mh_nav_row_img {\
width: 100px;\
min-height:37px;\
max-height:38px;\
float: left;\
margin-right:10px;\
}\
.__mh_bookmark_container{\
    width: 380px;\
}\
.__mh_ended{\
filter: url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'grayscale\'><feColorMatrix type=\'matrix\' values=\'0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0.3333 0.3333 0.3333 0 0 0 0 0 1 0\'/></filter></svg>#grayscale"); /* Firefox 3.5+ */ \
-webkit-filter: grayscale(100%);\
}\
.__mh_bookmark_container .nav__row{\
padding:0px;\
background-color:#f0f2f5;\
}\
.__mh_no_bookmarks{\
color:gray;\
}\
');
}
})();