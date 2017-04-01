// ==UserScript==
// @name         SG Bookmarks
// @namespace    http://steamgifts.com/
// @version      1.0.0
// @description  Bookmark giveaways
// @author       mahermen,crazoter
// @downloadURL  https://github.com/maherm/steamgifts_scripts/raw/master/sg_bookmarks.user.js
// @require      https://code.jquery.com/jquery-3.1.1.min.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.6/sgapi.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.6/sgapi_gatools.js
// @require      https://raw.githubusercontent.com/maherm/sgapi/v0.1.6/sgapi_settings.js
// @require      http://momentjs.com/downloads/moment.min.js
// @resource     css https://raw.githubusercontent.com/maherm/steamgifts_scripts/040086/sg_bookmarks.css
// @include      http*://www.steamgifts.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_getResourceText
// @grant        GM_addStyle
// ==/UserScript==

/*jshint multistr: true */

use(SgApi);
use(Util);

//Runtime variables
var data = new Data();
var lazyTrainManager = {};//Used to keep track of which giveaways are a train and identify the start and end of said trains.Format:{{desc1:String}: {timesOccured:int},{desc2:String}: {timesOccured:int},...}
var prevNavRow;
var navRowIsTrain = false;
//In order to prevent racing issues, bookmarks are obtained using AJAX. However, this may cause a problem if the user navigates away from the page if the AJAX is not complete yet.
//queuedBookmarkIds is there to catch these interrupted AJAX requests and ensure the integrity of the bookmarks.
var queuedBookmarkIds = getQueuedBookmarkIds();

//Settings
var SETTINGS_STATES = "Show giveaway status";
var SETTINGS_TRAIN = "Group giveaways in a train";
var settings = new Settings("SG_Bookmarks")
		.boolean("Show giveaway status", true, {description:"Dim entered giveaways and color giveaways you cannot enter.", values: ["No", "Yes"]})
    .boolean("Group giveaways in a train", true, {description:"Show which giveaways are in the same train.", values: ["No", "Yes"]});
settings=settings.init({instantSubmit: true,useGmStorage:true});

//CONSTANTS
var STATE_NOT_ENTERED = "unentered";
var STATE_ENTERED = "entered";
var STATE_OWNED = "owned";//Owned
var STATE_ENDED = "ended";
var MAX_BOOKMARK_STR_LENGTH = 39;


function main(){
	syncQueuedBookmarkIds();
	requireDeclaredStyles();
	readBookmarks();
  initSettings();
	fixDatabase();
	if(isGiveaway()){
		if(amIBookmarked()) {
		  $("div.sidebar__entry-delete").click(function(){updateBookmark(false);});//setup giveaway update
			$("div.sidebar__entry-insert").click(function(){updateBookmark(true);});//setup giveaway update
		}
	   showButton();
	}
   addNavButton();
}

function fixDatabase(){
	var fixedEntered = true;//GM_getValue("fixedEntered",false);
	if(parseBool(GM_getValue("fixedDb0.7", false)) && fixedEntered){
		return; //already fixed
	}
	console.log("Fixing corrupted database...");
	for(var k in data.bookmarks){
		if(k===undefined || k === "undefined"){
			clearBookmark(k);
		}
		if(!fixedEntered || data.bookmarks[k] === undefined || Object.keys(data.bookmarks[k]).length===0){
			console.log("Fixing ",k);
			clearBookmark(k);
			Giveaways.loadGiveaway(k, function(ga){
				delete ga.descriptionHtml;
				data.bookmarks[k] = unwrap(ga);
				saveData();
				try{
					buildNavRows();
				}catch(e){
					console.error(e);
				}
			});
		}
	}
	console.log("Fixed Database");
	GM_setValue("fixedDb0.7", true);
	GM_setValue("fixedEntered",true);
}


function closeBookmarkContainer(){
	var $button = $('.__mh_bookmark_button');
	var $dropdown = $(".___mh_bookmark_outer_container.nav__relative-dropdown");
	$dropdown.addClass("is-hidden");
	$button.removeClass("nav__button-container--active").addClass("nav__button-container--inactive");
}

function openBookmarkContainer(e){
	var  $t=$(this);
	setTimeout(function(){
			$t.addClass("nav__button-container--active");
			$(".___mh_bookmark_outer_container.nav__relative-dropdown").removeClass("is-hidden");
            $("html, body").animate({ scrollTop: 0 }, "fast");
	},0);
    return false;
}

function addBookmarkMenuItem(title,descr,url,imgUrl,hasEnded,id,state){
	 var $html = $('<a class="nav__row" id="__mh_'+id+'"></a>');
	$html.addClass("__mh_bookmark_item");
	 if(hasEnded)
		 $html.addClass(" __mh_ended");
	 else if(settings.get(SETTINGS_STATES) && state) 
		 $html.addClass("__mh_state_"+state);
	if(url)
		$html.attr("href",url);
  if(settings.get(SETTINGS_TRAIN)) {
	  if(!lazyTrainManager[descr]) {//First time seeing this descript
			 lazyTrainManager[descr] = 1;
			if(navRowIsTrain && prevNavRow) {//apply "track end" style to last train giveaway
				$(prevNavRow).addClass("__mh_train_end");
			}
			navRowIsTrain = false;
			} else {
				navRowIsTrain = true;
				lazyTrainManager[descr]++;
				$html.addClass("__mh_mid_train");//I mean, trains are usually by the same person and usually end at the same time
				$html.append('<i class="__mh_train_tracks"></i>');
			}
	}
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
	 prevNavRow = document.getElementById('__mh_'+id);
}

function addNavRow(bookmarkData){
   var title = bookmarkData.gameTitle;
   var steamAppId = bookmarkData.steamAppId || bookmarkData.steamId;
   var id = bookmarkData.id;
   var url = buildGiveawayUrl(id);
   var creator = bookmarkData.creator;
   var ends = bookmarkData.endTime;
   var cp = bookmarkData.cp;
   var imgUrl = bookmarkData.thumbUrl || getGameThumbUrl(steamAppId);
   var endsAt = moment.unix(ends);
   var hasEnded = endsAt.isBefore(moment());
	 var cpstr = " ("+cp+"P)";
	 if(title.length + cpstr.length > MAX_BOOKMARK_STR_LENGTH) {
		 title = title.substr(0,MAX_BOOKMARK_STR_LENGTH - cpstr.length) + "…";
	 }
   title = title+ cpstr;
   var endsStr = hasEnded ? "ended" : "ends";
   var descr = "by "+creator+" - "+endsStr+" "+endsAt.fromNow();
   var state = STATE_NOT_ENTERED;
	 if(bookmarkData.isEntered) { state = STATE_ENTERED; } 
	else if(bookmarkData.isOwned) { state = STATE_OWNED; }
	else if(bookmarkData.hasEnded) { state = STATE_ENDED; }
   addBookmarkMenuItem(title,descr,url,imgUrl,hasEnded,id,state);
}

function clearNavRows(){
	$(".__mh_bookmark_container").empty();
	lazyTrainManager = {};
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
							<a class="nav__button"><i class="fa fa-bookmark"></i></a></div>');
	var $dropdown = $('<div class="nav__relative-dropdown ___mh_bookmark_outer_container is-hidden"><div class="nav__absolute-dropdown __mh_bookmark_container"></div></div>');
	$html.append($dropdown);
	$dropdown.insertAfter("header");

	updateBadge($html);
	$html.attr("title", "Bookmarked Giveaways");
	$html.on("click.bookmark",openBookmarkContainer);
	$(".nav__right-container").prepend($html);
	$(document).on("click.bookmark",":not(.___mh_bookmark_outer_container)",closeBookmarkContainer);
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
	var result = Giveaways.currentGiveaway();
	delete result.descriptionHtml; //We dont want to save HTML in GM_storage that we dont need
	return unwrap(result);
}

function saveData(){
	 GM_setValue("__mh_bookmarks", data);
}

function clearBookmark(gaId){
   delete data.bookmarks[gaId];
   saveData();
}

function updateBookmark(entering) {
	queueBookmarkId(getCurrentId());
	Giveaways.loadGiveaway(getCurrentId(), function(ga){
				delete ga.descriptionHtml;
		    ga = unwrap(ga);
		    readBookmarks();
		    if(entering) { ga.isEntered = true; }//assume success
				else { ga.isEntered = false; }
				saveBookmark(getCurrentId(), ga);
				try{
					buildNavRows();
				}catch(e){
					console.error(e);
				}
		    unqueueBookmarkId(getCurrentId());
	});
}

function saveBookmark(gaId, bookmarkData){
	data.bookmarks[gaId] = bookmarkData;
	saveData();
}

function toggleBookmark(gaId){
	readBookmarks();
	if(isBookmarked(gaId))
		clearBookmark(gaId);
	else {
		  queueBookmarkId(gaId);
			Giveaways.loadGiveaway(gaId, function(ga){
					delete ga.descriptionHtml;
					ga = unwrap(ga);
					saveBookmark(gaId, ga);
					try{
						buildNavRows();
						updateButtonState();
					}catch(e){
						console.error(e);
					}
		});
	}
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

function getQueuedBookmarkIds() {
	return JSON.parse(GM_getValue("__mh_queuedBookmarkIds", "{}"));
}
function syncQueuedBookmarkIds() {
	$.each(queuedBookmarkIds,function(k,v) {
		Giveaways.loadGiveaway(k, function(ga){
				delete ga.descriptionHtml;
		    ga = unwrap(ga);
		    saveBookmark(k, ga);
				try{
					buildNavRows();
				}catch(e){
					console.error(e);
				}
			  unqueueBookmarkId(k);
				if(readCurrentData().id == ga.id) {//if on the page
					updateButtonState(); 
				}
	 });
	});
}
function queueBookmarkId(gaId) {
	queuedBookmarkIds[gaId] = 1;
	GM_setValue("__mh_queuedBookmarkIds", JSON.stringify(queuedBookmarkIds));
}
function unqueueBookmarkId(gaId) {
	delete queuedBookmarkIds[gaId];
	GM_setValue("__mh_queuedBookmarkIds", JSON.stringify(queuedBookmarkIds));
}

function Data(){
	var that = this;
	this.bookmarks = {};
}

main();