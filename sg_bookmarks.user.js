// ==UserScript==
// @name         SG Bookmarks
// @namespace    http://steamgifts.com/
// @version      0.6
// @description  Bookmark giveaways
// @author       mahermen
// @downloadURL  https://github.com/maherm/steamgifts_scripts/raw/master/sg_bookmarks.user.js
// @require      https://code.jquery.com/jquery-3.1.1.min.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.5/sgapi.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.5/sgapi_gatools.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.5/sgapi_settings.js
// @require      http://momentjs.com/downloads/moment.min.js
// @resource     css https://raw.githubusercontent.com/maherm/steamgifts_scripts/9edf74/sg_bookmarks_v2.css
// @include      http*://www.steamgifts.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_getResourceText
// ==/UserScript==

/*jshint multistr: true */

use(SgApi);
use(Util);

var data = new Data();

function main(){
	//requireDeclaredStyles();
    requireCss("https://manuelhermenau.de/scripts/sg_bookmarks_v2.css");
	readBookmarks();
    initSettings();
	if(isGiveaway()){
	   showButton();
	}
   addNavButton();
}

function updateMenuButtonState(){
	var $button = $('.__mh_bookmark_button');
	var $dropdown = $button.find(".nav__relative-dropdown");
	if($dropdown.hasClass("is-hidden")){
		$button.removeClass("nav__button-container--active").addClass("nav__button-container--inactive");
	}
}

function toggleBookmarkContainer(e){
	var  $t=$(this);
	setTimeout(function(){
			$t.addClass("nav__button-container--active").find(".nav__relative-dropdown").removeClass("is-hidden");
	},0);
}

function addBookmarkMenuItem(title,descr,url,imgUrl,hasEnded,id){
	 var $html = $('<a class="nav__row"></a>');
	$html.addClass("__mh_bookmark_item");
	 if(hasEnded)
		 $html.addClass(" __mh_ended");
	if(url)
		$html.attr("href",url);
	if(imgUrl)
		$html.append('<img class="__mh_nav_row_img" src="'+imgUrl+'">');
	var $div = $('<div class="nav__row__summary">');
	var $titleP = $('<p class="nav__row__summary__name">'+(title?title:"")+'</p>');
	var $descrP = $('<p class="nav__row__summary__description">'+(descr?descr:'')+'</p>');
	$div.append($titleP);
	$div.append($descrP);
	$html.append($div);
	if(id){
		var $remove = $('<i class="icon-red fa fa-times-circle __mh_bookmark_item_remove_btn"></i>');
		$remove.click(function(){
			toggleBookmark(id);
			updateButtonState();
			updateBadge($(".__mh_bookmark_button"));
			return false;
		});
		$html.append($remove);
	}
   $(".__mh_bookmark_container").append($html);
}

function addNavRow(bookmarkData){
   var title = bookmarkData.gameTitle;
   var steamAppId = bookmarkData.steamAppId || bookmarkData.steamId;
   var id = bookmarkData.id;
   var url = buildGiveawayUrl(id);
   var creator = bookmarkData.creator;
   var ends = bookmarkData.endTime;
   var cp = bookmarkData.cp;
   var imgUrl = bookmarkData.thumbUrl;
   var endsAt = moment.unix(ends);
   var hasEnded = endsAt.isBefore(moment());
   title = title+ " ("+cp+"P)";
   var endsStr = hasEnded ? "ended" : "ends";
   var descr = "by "+creator+" - "+endsStr+" "+endsAt.fromNow();
   addBookmarkMenuItem(title,descr,url,imgUrl,hasEnded,id);
}

function clearNavRows(){
	$(".__mh_bookmark_container").empty();
}

function buildNavRows(){
	clearNavRows();
	var lst = bookmarkList();
	if(lst.length > 0)
		$.each(bookmarkList(),function(i,e){addNavRow(e);});
	else
		addBookmarkMenuItem("<div class='nav__row__summary__name __mh_no_bookmarks'>No bookmarks</div>",false,false,"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

}

function updateBadge($html){
    var doNotify = data.settings.get("Notify if Giveaways are about to end");
	var timespan = data.settings.get("Minutes before Ending");
	if(!doNotify)
		return;
	var badgeNum = bookmarkList().filter(function(e){
		return moment.unix(e.endTime).isBetween(moment(), moment().add(timespan, "minutes"));
	}).length;
   if(badgeNum>0){
	   $html.find("a.nav__button").append("<div class='nav__notification'>"+badgeNum+"</div>");
   }else{
	   $html.find("a.nav__button .nav__notification").remove();
   }
}

function addNavButton(){
	var $html = $('<div class="nav__button-container nav__button-container--notification __mh_bookmark_button"> \
							<a class="nav__button"><i class="fa fa-bookmark"></i></a>\
<div class="nav__relative-dropdown is-hidden"><div class="nav__absolute-dropdown __mh_bookmark_container">\
</div></div></div>');
	updateBadge($html);
	$html.attr("title", "Bookmarked Giveaways");
	$html.on("click.bookmark",toggleBookmarkContainer);
	$(".nav__right-container").prepend($html);
	$(document).on("click.bookmark",function(){setTimeout(updateMenuButtonState,0);});
   buildNavRows();
}

function toggleBookmarkCurrentPage(){
	toggleBookmark(getCurrentId());
	updateButtonState();
	updateBadge($(".__mh_bookmark_button"));
}

function amIBookmarked(){
	return isBookmarked(getCurrentId());
}

function isBookmarked(id){
	return data.bookmarks[id] !== undefined;
}
function updateButtonState(){
	var $faIcon = $(".__mh_bookmarked_icon");
	var isBookmarked = amIBookmarked();
	var css = "fa fa-bookmark" + (isBookmarked ? "" :"-o");
	var title = isBookmarked ? "Clear bookmark for this giveaway" : "Bookmark this Giveaway";
	$faIcon.removeClass("fa-bookmark fa-bookmark-o");
	$faIcon.addClass(css);
	$faIcon.attr("title",title);
}
function showButton(){
	var $ci =getContextInfoContainer();
	var $bookmarkBtn = $("<a><i class='__mh_bookmarked_icon'></i></a>");
	$bookmarkBtn.click(toggleBookmarkCurrentPage);
	$ci.append($bookmarkBtn);
	updateButtonState();
}
function getContextInfoContainer(){
	var ciClass="__mh_ci";
	var $ci = $("."+ciClass);
	if($ci.length===0){
		$ci = $("<span class='"+ciClass+"'></span>");
		$ci.insertAfter($(".featured__heading__small").last());
	}
	return $ci;
}

function readCurrentData(){
	return Giveaways.currentGiveaway();
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

function initSettings(){
    data.settings = new SgApi.Settings("SG Bookmarks")
        .boolean("Notify if Giveaways are about to end", true)
        .int("Minutes before Ending", 10, {minValue:1})
        .init({instantSubmit:true});
}

function readBookmarks(){
	data.bookmarks = GM_getValue("__mh_bookmarks", new Data()).bookmarks;
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


function Data(){
	var that = this;
	this.bookmarks = {};
}

main();