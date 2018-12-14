$hub = null;
window.NULL = null;
var localPushLastPayload = null;
window.COM_TIMEFORMAT = 'YYYY-MM-DD HH:mm:ss';
window.COM_TIMEFORMAT2 = 'YYYY-MM-DDTHH:mm:ss';
function setUserinfo(user){localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.USERINFO", JSON.stringify(user));}
function getUserinfo(){var ret = {};var str = localStorage.getItem("COM.QUIKTRAK.QUIKLOC8.USERINFO");if(str) {ret = JSON.parse(str);} return ret;}
function isJsonString(str){try{var ret=JSON.parse(str);}catch(e){return false;}return ret;}
function toTitleCase(str){return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});}

function guid() {
  function S4() {
    return (((1+Math.random())*0x10000)|0).toString(16).substring(1);
  }
  return (S4()+S4()+"-"+S4()+"-"+S4()+"-"+S4()+"-"+S4()+S4()+S4());
}

function getPlusInfo(){
    var uid = guid();
    if(window.device) {
        if(!localStorage.PUSH_MOBILE_TOKEN){
        localStorage.PUSH_MOBILE_TOKEN = uid;
        }
        localStorage.PUSH_APP_KEY = BuildInfo.packageName;
        localStorage.PUSH_APPID_ID = BuildInfo.packageName;
        localStorage.DEVICE_TYPE = device.platform;
    }else{
            if(!localStorage.PUSH_MOBILE_TOKEN)
            localStorage.PUSH_MOBILE_TOKEN = uid;
            if(!localStorage.PUSH_APP_KEY)
            localStorage.PUSH_APP_KEY = uid;
            if(!localStorage.PUSH_DEVICE_TOKEN)
            localStorage.PUSH_DEVICE_TOKEN = uid;
            //localStorage.PUSH_DEVICE_TOKEN = "75ba1639-92ae-0c4c-d423-4fad1e48a49d"
        localStorage.PUSH_APPID_ID = 'webapp';
        localStorage.DEVICE_TYPE = "web";
    }
}

var inBrowser = 0;
localStorage.notificationChecked = 0;
var loginTimer = 0;


var loginInterval = null;
var pushConfigRetryMax = 40;
var pushConfigRetry = 0;

if( navigator.userAgent.match(/Windows/i) ){
    inBrowser = 1;
}
//alert(navigator.userAgent);

document.addEventListener("deviceready", onDeviceReady, false );

function onDeviceReady(){
    //fix app images and text size
    if (window.MobileAccessibility) {
        window.MobileAccessibility.usePreferredTextZoom(false);
    }
    if (StatusBar) {
        StatusBar.styleDefault();
    }
    setupPush();

    getPlusInfo();

    if (!inBrowser) {
        if(getUserinfo().MinorToken) {
            //login();
            preLogin();
        }
        else {
            logout();
        }
    }

    document.addEventListener("backbutton", backFix, false);
    document.addEventListener("resume", onAppResume, false);
    document.addEventListener("pause", onAppPause, false);
}

function setupPush(){
        var push = PushNotification.init({
            "android": {
                //"senderID": "264121929701"
            },
            "browser": {
                pushServiceURL: 'http://push.api.phonegap.com/v1/push'
            },
            "ios": {
                "sound": true,
                "vibration": true,
                "badge": true
            },
            "windows": {}
        });
        console.log('after init');

        push.on('registration', function(data) {
            console.log('registration event: ' + data.registrationId);
            //alert( JSON.stringify(data) );

            //localStorage.PUSH_DEVICE_TOKEN = data.registrationId;

            var oldRegId = localStorage.PUSH_DEVICE_TOKEN;
            if (localStorage.PUSH_DEVICE_TOKEN !== data.registrationId) {
                // Save new registration ID
                localStorage.PUSH_DEVICE_TOKEN = data.registrationId;
                // Post registrationId to your app server as the value has changed
                refreshToken(data.registrationId);
            }
        });

        push.on('error', function(e) {
            //console.log("push error = " + e.message);
            alert("push error = " + e.message);
        });

        push.on('notification', function(data) {
            //alert( JSON.stringify(data) );

            //if user using app and push notification comes
            if (data && data.additionalData && data.additionalData.foreground) {
               // if application open, show popup
               showMsgNotification([data.additionalData]);
            }
            else if (data && data.additionalData && data.additionalData.payload){
               //if user NOT using app and push notification comes
                App.showIndicator();

                loginTimer = setInterval(function() {
                    //alert(localStorage.notificationChecked);
                    if (localStorage.notificationChecked) {
                        clearInterval(loginTimer);
                        setTimeout(function(){
                            //alert('before processClickOnPushNotification');
                            processClickOnPushNotification([data.additionalData.payload]);
                            App.hideIndicator();
                        },1000);
                    }
                }, 1000);
            }
            if (device && device.platform && device.platform.toLowerCase() == 'ios') {
                push.finish(
                    () => {
                      console.log('processing of push data is finished');
                    },
                    () => {
                      console.log(
                        'something went wrong with push.finish for ID =',
                        data.additionalData.notId
                      );
                    },
                    data.additionalData.notId
                );
            }
        });


        if　(!localStorage.ACCOUNT){
            push.clearAllNotifications(
                () => {
                  console.log('success');
                },
                () => {
                  console.log('error');
                }
            );
        }
}




function onAppPause(){

}
function onAppResume(){
    if (localStorage.ACCOUNT && localStorage.PASSWORD) {
        getNewData();
        getNewNotifications();
    }

}


function backFix(event){
    var page=App.getCurrentView().activePage;
    if(page.name=="index"){
        App.confirm(LANGUAGE.PROMPT_MSG018, function () {
            navigator.app.exitApp();
        });
    }else{
        mainView.router.back();
    }
}



// Initialize your app
var App = new Framework7({
    animateNavBackIcon: true,
    swipeBackPage: false,
    //pushState: true,
    swipePanel: 'left',
    allowDuplicateUrls: true,
    sortable: false,
    modalTitle: 'AlertGPS',
    notificationTitle: 'AlertGPS',
    precompileTemplates: true,
    template7Pages: true,
    onAjaxStart: function(xhr){
        App.showIndicator();
    },
    onAjaxComplete: function(xhr){
        App.hideIndicator();
    }
});

// Export selectors engine
var $$ = Dom7;

// Add view
var mainView = App.addView('.view-main', {
    domCache: true,
    dynamicNavbar: true,
});

var AppDetails = {
    name: 'alertgps-app',
    code: 32,
    supportCode: 33,
};

var DEMOACCONTS = ['demochile'];

window.PosMarker = {};
var MapTrack = null;
var StreetViewService = null;
var TargetAsset = {};
var searchbar = null;
var trackTimer = false;
var updateAssetsPosInfoTimer = false;
var virtualAssetList = null;
var virtualNotificationList = null;
var POSINFOASSETLIST = {};
var verifyCheck = {}; // for password reset

var API_URL = {};
var API_DOMIAN1 = "http://api.m2mglobaltech.com/QuikProtect/V1/Client/";
var API_DOMIAN2 = "http://api.m2mglobaltech.com/QuikTrak/V1/";
var API_DOMIAN3 = "http://quiktrak.co/webapp/QuikProtect/Api2/";
var API_DOMIAN4 = "http://api.m2mglobaltech.com/Quikloc8/V1/";

//API_URL.URL_GET_LOGIN = API_DOMIAN1 + "Auth?account={0}&password={1}&appKey={2}&mobileToken={3}&deviceToken={4}&deviceType={5}";
API_URL.URL_GET_LOGIN = API_DOMIAN4 + "user/Auth?account={0}&password={1}&appKey={2}&mobileToken={3}&deviceToken={4}&deviceType={5}";

API_URL.URL_PREUPGRADE = API_DOMIAN4 + "asset/PreUpgrade?imei={0}&payPalnCode={1}";
API_URL.URL_SET_IMMOBILISATION = API_DOMIAN4 + "asset/Relay?MajorToken={0}&MinorToken={1}&code={2}&state={3}";
API_URL.URL_SET_GEOLOCK = API_DOMIAN4 + "asset/GeoLock?MajorToken={0}&MinorToken={1}&code={2}&state={3}";
API_URL.URL_GET_ASSET_DETAILS = API_DOMIAN4 + "asset/GetModel?MinorToken={0}&code={1}";
API_URL.URL_SET_ALARM = API_DOMIAN4 + "asset/AlarmOptions?MajorToken={0}&MinorToken={1}&imeis={2}&alarmOptions={3}";

API_URL.URL_GET_LOGOUT = API_DOMIAN1 + "Logoff?MinorToken={0}&deviceToken={1}&mobileToken={2}";
API_URL.URL_EDIT_ACCOUNT = API_DOMIAN1 + "AccountEdit?MajorToken={0}&MinorToken={1}&firstName={2}&surName={3}&mobile={4}&email={5}&address0={6}&address1={7}&address2={8}&address3={9}&address4={10}";
API_URL.URL_RESET_PASSWORD = API_DOMIAN2 + "User/Password?MinorToken={0}&oldpwd={1}&newpwd={2}";
//API_URL.URL_SET_ALARM = API_DOMIAN1 + "AlarmOptions?MajorToken={0}&MinorToken={1}&imei={2}&power={3}&geolock={4}&shock={5}&crash={6}&ignition=false&bilge=false";
//API_URL.URL_SET_ALARM = API_DOMIAN1 + "AlarmOptions2?MajorToken={0}&MinorToken={1}&imeis={2}&alarmOptions={3}";
API_URL.URL_SEND_COM_POS = API_DOMIAN3 + "SendPosCommand2.json?code={0}&imei={1}&timeZone={2}";
API_URL.URL_SEND_COM_STATUS = API_DOMIAN3 + "SendStatusCommand2.json?code={0}&imei={1}";
API_URL.URL_GET_BALANCE = API_DOMIAN1 + "Balance?MajorToken={0}&MinorToken={1}";
API_URL.URL_EDIT_DEVICE = API_DOMIAN2 + "Device/Edit?MinorToken={0}&Code={1}&name={2}&speedUnit={3}&initMileage={4}&initAccHours={5}&attr1={6}&attr2={7}&attr3={8}&attr4={9}&tag={10}&icon={11}";
API_URL.URL_VERIFY_BY_EMAIL = API_DOMIAN1 + "VerifyCodeByEmail?email={0}";
API_URL.URL_FORGOT_PASSWORD = API_DOMIAN1 + "ForgotPassword?account={0}&newPassword={1}&checkNum={2}";

//API_URL.URL_GET_ALL_POSITIONS = API_DOMIAN2 + "Device/GetPosInfos?MinorToken={0}";
API_URL.URL_GET_ALL_POSITIONS = API_DOMIAN2 + "Device/GetPosInfos2?MinorToken={0}&MajorToken={1}";
API_URL.URL_GET_POSITION = API_DOMIAN2 + "Device/GetPosInfo?MinorToken={0}&Code={1}";
API_URL.URL_GET_NEW_NOTIFICATIONS = API_DOMIAN1 +"Alarms?MinorToken={0}&deviceToken={1}";
API_URL.URL_PHOTO_UPLOAD = "http://upload.quiktrak.co/image/Upload";
API_URL.URL_SUPPORT = "http://support.quiktrak.eu/?name={0}&loginName={1}&email={2}&phone={3}&s={4}";

API_URL.URL_ROUTE = "https://www.google.com/maps/dir/?api=1&destination={0},{1}"; //&travelmode=walking
API_URL.URL_REFRESH_TOKEN = API_DOMIAN2 + "User/RefreshToken";

var html = Template7.templates.template_Login_Screen();
$$(document.body).append(html);
html = Template7.templates.template_Popover_Menu();
$$(document.body).append(html);
/*html = Template7.templates.template_AssetList();*/
$$('.index-title').html(LANGUAGE.MENU_MSG05);
$$('.index-search-input').attr('placeholder',LANGUAGE.COM_MSG06);
$$('.index-search-cancel').html(LANGUAGE.COM_MSG04);
$$('.index-search-nothing-found').html(LANGUAGE.COM_MSG05);


var cameraButtons = [
    {
        text: LANGUAGE.PROMPT_MSG025,
        onClick: function () {
            getImage(1);
        }
    },
    {
        text: LANGUAGE.PROMPT_MSG026,
        onClick: function () {
            getImage(0);
        }
    },
    {
        text: LANGUAGE.COM_MSG04,
        color: 'red',
        onClick: function () {
            //App.alert('Cancel clicked');
        }
    },
];

if (inBrowser) {
    if(localStorage.ACCOUNT && localStorage.PASSWORD) {
        preLogin();
    }
    else {
        logout();
    }
}

var virtualAssetList = App.virtualList('.assets_list', {
    // search item by item
    searchAll: function (query, items) {
        var foundItems = [];
        for (var i = 0; i < items.length; i++) {
            // Check if title contains query string
            if (items[i].Name.toLowerCase().indexOf(query.toLowerCase().trim()) >= 0) foundItems.push(i);
        }
        // Return array with indexes of matched items
        return foundItems;
    },
    //List of array items
    items: [
    ],
    height: function (item) {
        var asset = POSINFOASSETLIST[item.IMEI];
        var assetFeaturesStatus = Protocol.Helper.getAssetStateInfo(asset);
        var height = 85;
        //console.log(assetFeaturesStatus);
        if (assetFeaturesStatus && assetFeaturesStatus.voltage && assetFeaturesStatus.fuel || assetFeaturesStatus && assetFeaturesStatus.battery && assetFeaturesStatus.fuel || assetFeaturesStatus && assetFeaturesStatus.battery && assetFeaturesStatus.voltage) {
            height = 100;
        }
        return height; //display the image with 50px height
    },
    // Display the each item using Template7 template parameter
    renderItem: function (index, item) {
       //console.log(item);
        var ret = '';
        //console.log(POSINFOASSETLIST);
        var asset = POSINFOASSETLIST[item.IMEI];
        //if (asset) {
            var assetFeaturesStatus = Protocol.Helper.getAssetStateInfo(asset);
            //var assetImg = 'resources/images/svg_asset.svg';


            var assetImg = getAssetImg(item, {'assetList':true});

            if (assetFeaturesStatus && assetFeaturesStatus.stats) {
                if (item.PayPlanName) {
                    item.PayPlanName = Protocol.Helper.getAssetPayPlanName(item.PayPlanName);
                }

                ret +=  '<li class="item-link item-content item_asset" data-imei="' + item.IMEI + '" data-id="' + item.Id + '" data-name="' + item.Name + '">';
                ret +=      '<div class="item-media">'+assetImg+'</div>';
                ret +=      '<div class="item-inner">';
                ret +=          '<div class="item-title-row">';
                ret +=              '<div class="item-title">' + item.Name + '</div>';
                ret +=                  '<div class="item-after"><i id="signal-state'+item.IMEI+'" class="f7-icons icon-other-signal '+assetFeaturesStatus.GSM.state+'"></i><i id="satellite-state'+item.IMEI+'" class="f7-icons icon-other-satellite '+assetFeaturesStatus.GPS.state+'"></i></div>';
                ret +=          '</div>';
                //ret +=          '<div id="status-state'+item.IMEI+'" class="item-subtitle '+assetFeaturesStatus.status.state+'"><i class="icon-status-fix icon-data-status-1"></i><span id="status-value'+item.IMEI+'">'+assetFeaturesStatus.status.value+'</span></div>';
                // ret += 			'<div id="plan-name'+item.IMEI+'" class="item-subtitle">'+ item.PayPlanName +'</div>';
                ret +=          '<div class="item-text">';
                ret +=              '<div class="row no-gutter">';
                                    if (assetFeaturesStatus.speed) {
                ret +=                  '<div class="col-50">';
                ret +=                     '<i class="f7-icons icon-other-data-speed asset_list_icon "></i>';
                ret +=                     '<span id="speed-value'+item.IMEI+'" class="">'+assetFeaturesStatus.speed.value+'</span>';
                ret +=                  '</div>';
                                    }
                                    if (assetFeaturesStatus.voltage) {
                ret +=                  '<div class="col-50">';
                ret +=                     '<i class="f7-icons icon-other-data-battery asset_list_icon "></i>';
                ret +=                     '<span id="voltage-value'+item.IMEI+'" class="">'+assetFeaturesStatus.voltage.value+'</span>';
                ret +=                  '</div>';
                                    }
                                    if (assetFeaturesStatus.battery) {
                ret +=                  '<div class="col-50">';
                ret +=                     '<i class="f7-icons icon-other-data-battery-level asset_list_icon "></i>';
                ret +=                     '<span id="battery-value'+item.IMEI+'" class="">'+assetFeaturesStatus.battery.value+'</span>';
                ret +=                  '</div>';
                                    }
                                    if (assetFeaturesStatus.temperature) {
                ret +=                  '<div class="col-50">';
                ret +=                     '<i class="f7-icons icon-other-data-temperature asset_list_icon "></i>';
                ret +=                     '<span id="temperature-value'+item.IMEI+'" class="">'+assetFeaturesStatus.temperature.value+'</span>';
                ret +=                  '</div>';
                                    }
                                    if (assetFeaturesStatus.fuel) {
                ret +=                  '<div class="col-50">';
                ret +=                     '<i class="f7-icons icon-other-data-fuel asset_list_icon "></i>';
                ret +=                     '<span id="fuel-value'+item.IMEI+'" class="">'+assetFeaturesStatus.fuel.value+'</span>';
                ret +=                  '</div>';
                                    }
                                    /*if (assetFeaturesStatus.driver){
                ret +=                  '<div class="col-50">';
                ret +=                      '<img class="asset_list_icon" src="resources/images/svg_ico_driver.svg" alt="">';
                ret +=                       '<span id="driver-value'+item.IMEI+'" class="">'+assetFeaturesStatus.driver.value+'</span>';
                ret +=                  '</div>';
                                    } */
                ret +=              '</div>';
                ret +=          '</div>';
                ret +=      '</div>';
                ret +=  '</li>';



            }else{
                console.log('NO POSINFO for - '+item.IMEI);
                ret +=  '<li class="item-link item-content item_asset" data-imei="' + item.IMEI + '" data-id="' + item.Id + '" data-name="' + item.Name + '" title="No data">';
                ret +=      '<div class="item-media">'+assetImg+'</div>';
                ret +=      '<div class="item-inner">';
                ret +=          '<div class="item-title-row">';
                ret +=              '<div class="item-title">' + item.Name + '</div>';
                ret +=                  '<div class="item-after"><i class="f7-icons icon-other-signal state-0"></i><i class="f7-icons icon-other-satellite state-0"></i></div>';
                ret +=          '</div>';
                ret +=          '<div class="item-subtitle state-0"><i class="icon-status-fix icon-data-status-1"></i>'+LANGUAGE.COM_MSG11+'</div>';
                ret +=      '</div>';
                ret +=  '</li>';
            }



        return ret;
    },
});

$$('body').on('click', '#account, #password', function(e){
    setTimeout(function(){
        $('.login-screen-content').scrollTop(200);
    },1000);
});

$$('body').on('click', 'a.external', function(event) {
    event.preventDefault();
    var href = this.getAttribute('href');
    if (href) {
        if (typeof navigator !== "undefined" && navigator.app) {
            navigator.app.loadUrl(href, {openExternal: true});
        } else {
            window.open(href,'_blank');

        }
    }
    return false;
});
$$('.login-form').on('submit', function (e) {
    e.preventDefault();
    preLogin();
    return false;
});
$$('body').on('click', '.toggle-password', function(){
    var password = $(this).siblings("input[name='password']");
    if(password.hasClass('show_pwd')){
        password.prop("type", "password").removeClass('show_pwd');
    }else{
        password.prop("type", "text").addClass('show_pwd');
    }
    $(this).toggleClass('color-gray');
});



$$('body').on('click', '.notification_button', function(e){
    getNewNotifications({'loadPageNotification':true});
    $$('.notification_button').removeClass('new_not');
});

$$('body').on('click', '.deleteAllNotifications', function(){
    App.confirm(LANGUAGE.PROMPT_MSG016, function () {
        removeAllNotifications();
        $$('.deleteAllNotifications').addClass('disabled');
        mainView.router.back({
            pageName: 'index',
            force: true
        });
    });
});

$$(document).on('refresh','.pull-to-refresh-content',function(e){
    getNewNotifications({'ptr':true});
});

$$(document).on('change', '.leaflet-control-layers-selector[type="radio"]', function(){
    if (TargetAsset.IMEI) {

        var span = $$(this).next();
        var switcherWrapper = span.find('.mapSwitcherWrapper');
        if (switcherWrapper && switcherWrapper.hasClass('satelliteSwitcherWrapper')) {
            window.PosMarker[TargetAsset.IMEI].setIcon(Protocol.MarkerIcon[1]);
        }else{
            window.PosMarker[TargetAsset.IMEI].setIcon(Protocol.MarkerIcon[0]);
        }
    }
});

$$('body').on('click', '#menu li', function () {
    var id = $$(this).attr('id');
    var activePage = App.getCurrentView().activePage;
    //console.log(id);
    switch (id){
        case 'menuHome':
            mainView.router.back({
              pageName: 'index',
              force: true
            });
            break;
        case 'menuProfile':
            if ( typeof(activePage) == 'undefined' || (activePage && activePage.name != "profile.user")) {
                loadPageProfile();
            }
            break;
        case 'menuAlarms':
            if ( typeof(activePage) == 'undefined' || (activePage && activePage.name != "alarms.assets")) {
                checkBalanceAndLoadPage('alarms.assets');
            }
            break;
        case 'menuRechargeCredit':
            if ( typeof(activePage) == 'undefined' || (activePage && activePage.name != "user.recharge.credit")) {
                loadPageRechargeCredit();
            }
        	break;
        /*case 'menuSupport':
            if ( typeof(activePage) == 'undefined' || (activePage && activePage.name != "user.support")) {
                loadPageSupport();
            }
            break;*/

        case 'menuLogout':
            App.confirm(LANGUAGE.PROMPT_MSG012, LANGUAGE.MENU_MSG04, function () {
                logout();
            });
            break;

    }
});

$$(document).on('click', 'a.tab-link', function(e){
    e.preventDefault();
    var currentPage = App.getCurrentView().activePage.name;
    var page = $$(this).data('id');

    if (currentPage != page) {
        switch (page){
            case 'profile.user':
                loadPageProfile();
                break;
            case 'profile.password':
                loadPagePassword();
                break;
        }
    }

    return false;
});

$$('.assets_list').on('click', '.item_asset', function(){
    TargetAsset.IMEI =  $$(this).data("imei");
    TargetAsset.ID = $$(this).data("id");
    TargetAsset.Name = $$(this).data("name");
    TargetAsset.Img = '';

    loadPageAsset();
});

App.onPageInit('notification', function(page){

    var notificationContainer = $$(page.container).find('.notification_list');
	virtualNotificationList = App.virtualList(notificationContainer, {
        //List of array items
        items: [],
        height: function (item) {
			var height = 56;
			return height; //display the image with 50px height
		},
        // Display the each item using Template7 template parameter
        renderItem: function (index, item) {
            var ret = '';
            //alert(JSON.stringify(item));



            if (typeof item == 'object') {
            	if (!item.alarm) {
                    item.alarm = 'Alarm';
                }else if (item.alarm && typeof(item.alarm) == "string"){
                    item.alarm = toTitleCase(item.alarm);
                }

            	switch (item.alarm){
	                case 'Status':
	                    ret = '<li class="swipeout" data-id="'+item.listIndex+'" data-alarm="'+item.alarm+'" >' +
	                                '<div class="swipeout-content item-content">' +
	                                    '<div class="item-inner">' +
	                                        '<div class="item-title-row">' +
	                                            '<div class="item-title">'+item.AssetName+'</div>' +
	                                            '<div class="item-after">'+item.CreateDateTime+'</div>' +
	                                        '</div>' +
	                                        '<div class="item-subtitle">'+item.alarm+'</div>' +
	                                    '</div>' +
	                                '</div>' +
	                                '<div class="swipeout-actions-left">' +
	                                    '<a href="#" class="swipeout-delete swipeout-overswipe" data-confirm="'+LANGUAGE.PROMPT_MSG010+'" data-confirm-title="'+LANGUAGE.PROMPT_MSG014+'" data-close-on-cancel="true"><i class="f7-icons icon-header-delete"</i></a>' +
	                                '</div>' +
	                            '</li>';
	                    break;

                    default:
                        ret = '<li class="swipeout" data-id="'+item.listIndex+'" data-alarm="'+item.alarm+'" data-lat="'+item.Lat+'" data-lng="'+item.Lng+'"  >' +
                                    '<div class="swipeout-content item-content">' +
                                        '<div class="item-inner">' +
                                            '<div class="item-title-row">' +
                                                '<div class="item-title">'+item.AssetName+'</div>' +
                                                '<div class="item-after">'+item.PositionTime+'</div>' +
                                            '</div>' +
                                            '<div class="item-subtitle">'+item.alarm +'</div>' +
                                        '</div>' +
                                    '</div>' +
                                    '<div class="swipeout-actions-left">' +
                                        '<a href="#" class="swipeout-delete swipeout-overswipe" data-confirm="'+LANGUAGE.PROMPT_MSG010+'" data-confirm-title="'+LANGUAGE.PROMPT_MSG014+'" data-close-on-cancel="true"><i class="f7-icons icon-header-delete"</i></a>' +
                                    '</div>' +
                                '</li>';
	                /*case 'Location':
	                	ret = '<li class="swipeout" data-id="'+item.listIndex+'" data-alarm="'+item.alarm+'" data-lat="'+item.Lat+'" data-lng="'+item.Lng+'"  >' +
	                                '<div class="swipeout-content item-content">' +
	                                    '<div class="item-inner">' +
	                                        '<div class="item-title-row">' +
	                                            '<div class="item-title">'+item.AssetName+'</div>' +
	                                            '<div class="item-after">'+item.PositionTime+'</div>' +
	                                        '</div>' +
	                                        '<div class="item-subtitle">'+item.alarm +'</div>' +
	                                    '</div>' +
	                                '</div>' +
	                                '<div class="swipeout-actions-left">' +
	                                    '<a href="#" class="swipeout-delete swipeout-overswipe" data-confirm="'+LANGUAGE.PROMPT_MSG010+'" data-confirm-title="'+LANGUAGE.PROMPT_MSG014+'" data-close-on-cancel="true"><i class="f7-icons icon-header-delete"</i></a>' +
	                                '</div>' +
	                            '</li>';
	                break;

	                default:

	                    if (typeof item.speed === "undefined") {
                            item.speed = 0;
                        }
                        if (typeof item.direct === "undefined") {
                            item.direct = 0;
                        }
                        if (typeof item.mileage === "undefined") {
                            item.mileage = '-';
                        }


		                ret = '<li class="swipeout" data-id="'+item.listIndex+'" data-title="'+item.title+'" data-type="'+item.type+'" data-imei="'+item.imei+'" data-name="'+item.name+'" data-lat="'+item.lat+'" data-lng="'+item.lng+'" data-time="'+item.time+'" data-speed="'+item.speed+'" data-direct="'+item.direct+'" data-mileage="'+item.mileage+'">' +
		                            '<div class="swipeout-content item-content">' +
		                                '<div class="item-inner">' +
		                                    '<div class="item-title-row">' +
		                                        '<div class="item-title">'+item.name+'</div>' +
		                                        '<div class="item-after">'+item.time+'</div>' +
		                                    '</div>' +
		                                    '<div class="item-subtitle">'+item.title+'</div>' +
		                                '</div>' +
		                            '</div>' +
		                            '<div class="swipeout-actions-left">' +
		                                '<a href="#" class="swipeout-delete swipeout-overswipe" data-confirm="'+LANGUAGE.PROMPT_MSG010+'" data-confirm-title="'+LANGUAGE.PROMPT_MSG014+'" data-close-on-cancel="true"><i class="f7-icons icon-header-delete"</i></a>' +
		                            '</div>' +
		                        '</li>';*/
	            }
            }

            return  ret;
        }
    });

	var user = localStorage.ACCOUNT;
    var notList = getNotificationList();
    //console.log(notList[user]);
    showNotification(notList[user]);
    //getNewNotifications();

    notificationWrapper = $$('.notification_list');
    notificationWrapper.on('deleted', '.swipeout', function () {
        var index = $$(this).data('id');
        removeNotificationListItem(index);
    });

    notificationWrapper.on('click', '.swipeout', function(){
        if ( !$$(this).hasClass('transitioning') ) {  //to preven click when swiping
            var data = {};
            data.lat = $$(this).data('lat');
            data.lng = $$(this).data('lng');
            data.alarm = $$(this).data('alarm');

            var index = $$(this).data('id');
            var list = getNotificationList();
            var user = localStorage.ACCOUNT;
            var msg = list[user][index];
            var props = null;

            if (msg) {
                if (msg.payload) {
                    props = isJsonString(msg.payload);
                    if (!props) {
                        props = msg.payload;
                    }
                }else{
                    props = isJsonString(msg);
                    if (!props) {
                        props = msg;
                    }
                }
            }
            //console.log(props);
            if (data.alarm == 'Status') {
                loadPageStatusMessage(props);
            }else if(  props && parseFloat(data.lat) && parseFloat(data.lat)){
                TargetAsset.IMEI = props.Imei ? props.Imei : props.imei;
                loadPageLocation(props);
            }else{
            	App.alert(LANGUAGE.PROMPT_MSG023);
            }
        }
    });

});

App.onPageInit('user.recharge.credit', function (page) {
    $$('.button_buy_now').on('click', function(event){
        event.preventDefault();
        setTimeout(function(){
            App.modal({
                text: LANGUAGE.PROMPT_MSG030, //LANGUAGE.PROMPT_MSG017
                buttons: [
                    {
                        text: LANGUAGE.COM_MSG34,
                        onClick: function() {
                            checkBalance(true);
                        }
                    },
                    {
                        text: LANGUAGE.COM_MSG35,
                        onClick: function() {
                        }
                    },
                ]
            });
        }, 3000);

    });

});
App.onPageInit('asset', function (page) {
    //var buttonEditAsset = $$(page.container).find('.editAssetButton');
    var loadPageAlarm = $$(page.container).find('.loadPageAlarm');
    var loadPageTrackingInterval = $$(page.container).find('.loadPageTrackingInterval');
    var loadPageAssetPosition = $$(page.container).find('.loadPageAssetPosition');
    var loadPageAssetStatus = $$(page.container).find('.loadPageAssetStatus');
    var buttonGeolock = $$(page.container).find('.setGeolockState');
    var buttonImmob = $$(page.container).find('.setImmobiliseState');

    var assetList = getAssetList();
    var asset = assetList[TargetAsset.IMEI];



    $$('.uploadPhoto').on('click', function (e) {
        App.actions(cameraButtons);
    });

    $$('.editAssetButton').on('click', function(){
        asset = assetList[TargetAsset.IMEI];
    	var assetImg = getAssetImg(asset, {'assetPage':true});
    	//console.log(asset);
        mainView.router.load({
            url:'resources/templates/asset.edit.html',
            context:{
                AssetImg: assetImg,
                IMEI: asset.IMEI,
                PRDTName: asset.PRDTName,
                Name: asset.Name,
                Tag: asset.TagName,
                Unit: asset.Unit,
                Mileage: asset.InitMileage,
                Runtime: asset.InitAcconHours,
                Describe1: asset.Describe1,
                Describe2: asset.Describe2,
                Describe3: asset.Describe3,
                Describe4: asset.Describe4,
            }
        });
    });

    loadPageAlarm.on('click', function(){
        checkBalanceAndLoadPage('asset.alarm');
    });

    loadPageTrackingInterval.on('click', function(){
        var countryCode = getUserinfo().UserInfo.CountryCode;
        var trackingIntervalDetails = getTrackingIntervalDetailByCountyCode(countryCode);
        var data = {
            Name: asset.Name,
            IMEI: asset.IMEI,
            Cost: trackingIntervalDetails.cost,
            PayLink: trackingIntervalDetails.payLink,
            PayPlanCode: trackingIntervalDetails.payPlanCode,
        };

        mainView.router.load({
            url:'resources/templates/asset.tracking.interval.html',
            context: data
        });
    });

    loadPageAssetPosition.on('click', function(){
        loadPageLocation();
    });

    loadPageAssetStatus.on('click', function(){
        loadPageStatus();
    });

    buttonGeolock.on('click', function(){
        var params = {
            'clickedButton': this,
            'buttons': buttonGeolock,
            'stateFor': 'geolock',
        };
        changeState(params);
    });

    buttonImmob.on('click', function(){
        var params = {
            'clickedButton': this,
            'buttons': buttonImmob,
            'stateFor': 'immob',
        };
        changeState(params);
    });


});


App.onPageInit('asset.edit', function (page) {
    $$('.uploadPhoto').on('click', function (e) {
        App.actions(cameraButtons);
    });

    var selectUnitSpeed = $$('select[name="Unit"]');
    selectUnitSpeed.val(selectUnitSpeed.data("set"));

    $$('.saveAssetEdit').on('click', function(){

        var device = {
            IMEI: $$(page.container).find('input[name="IMEI"]').val(),
            Name: $$(page.container).find('input[name="Name"]').val(),
            Tag: $$(page.container).find('input[name="Tag"]').val(),
            Unit: $$(page.container).find('select[name="Unit"]').val(),
            Mileage: $$(page.container).find('input[name="Mileage"]').val(),
            Runtime: $$(page.container).find('input[name="Runtime"]').val(),
            Describe1: $$(page.container).find('input[name="Describe1"]').val(),
            Describe2: $$(page.container).find('input[name="Describe2"]').val(),
            Describe3: $$(page.container).find('input[name="Describe3"]').val(),
            Describe4: $$(page.container).find('input[name="Describe4"]').val(),
            Icon: TargetAsset.Img,
        };


        var userInfo = getUserinfo();

        var url = API_URL.URL_EDIT_DEVICE.format(userInfo.MinorToken,
                TargetAsset.ID,
                encodeURIComponent(device.Name),
                encodeURIComponent(device.Unit),
                encodeURIComponent(device.Mileage),
                encodeURIComponent(device.Runtime),
                encodeURIComponent(device.Describe1),
                encodeURIComponent(device.Describe2),
                encodeURIComponent(device.Describe3),
                encodeURIComponent(device.Describe4),
                encodeURIComponent(device.Tag),
                device.Icon
            );
        console.log(url);

        App.showPreloader();
        JSON1.request(url, function(result){
                console.log(result);
                if (result.MajorCode == '000') {
                    TargetAsset.Img = '';
                    updateAssetList(device);
                    init_AssetList();
                }else{
                    App.alert('Something wrong');
                }
                App.hidePreloader();
            },
            function(){ App.hidePreloader(); App.alert(LANGUAGE.COM_MSG02); }
        );
    });

});

App.onPageInit('asset.edit.photo', function (page) {
    //page.context.imgSrc = 'resources/images/add_photo_general.png';

    initCropper();
    //alert(cropper);

    //After the selection or shooting is complete, jump out of the crop page and pass the image path to this page
    //image.src = plus.webview.currentWebview().imgSrc;
    //image.src = "img/head-default.jpg";

    $$('#save').on('click', function(){
        saveImg();
    });
    $$('#redo').on('click', function(){
        cropper.rotate(90);
    });
    $$('#undo').on('click', function(){
        cropper.rotate(-90);
    });
});


App.onPageInit('profile.user', function (page) {

    $$('.saveProfile').on('click', function(e){
        var user = {
            FirstName: $$(page.container).find('input[name="FirstName"]').val(),
            SurName: $$(page.container).find('input[name="SurName"]').val(),
            Mobile: $$(page.container).find('input[name="Mobile"]').val(),
            Email: $$(page.container).find('input[name="Email"]').val(),
            Address0: $$(page.container).find('input[name="Address0"]').val(),
            Address1: $$(page.container).find('input[name="Address1"]').val(),
            Address2: $$(page.container).find('input[name="Address2"]').val(),
            Address3: $$(page.container).find('input[name="Address3"]').val(),
            Address4: $$(page.container).find('input[name="Address4"]').val()
        };

        var userInfo = getUserinfo();
        var url = API_URL.URL_EDIT_ACCOUNT.format(userInfo.MajorToken,
                userInfo.MinorToken,
                user.FirstName,
                user.SurName,
                user.Mobile,
                user.Email,
                user.Address0,
                user.Address1,
                user.Address2,
                user.Address3,
                user.Address4
            );
        console.log(url);
        App.showPreloader();
        JSON1.request(url, function(result){
                console.log(result);
                if (result.MajorCode == '000') {

                    userInfo.UserInfo.FirstName = user.FirstName;
                    userInfo.UserInfo.SurName = user.SurName;
                    userInfo.UserInfo.Mobile = user.Mobile;
                    userInfo.UserInfo.Email = user.Email;
                    userInfo.UserInfo.Address0 = user.Address0;
                    userInfo.UserInfo.Address1 = user.Address1;
                    userInfo.UserInfo.Address2 = user.Address2;
                    userInfo.UserInfo.Address3 = user.Address3;
                    userInfo.UserInfo.Address4 = user.Address4;

                    setUserinfo(userInfo);
                    updateMenuUserData(userInfo.UserInfo);
                    returnToIndex();
                }else if(result.MajorCode == '200'){
                    App.alert(LANGUAGE.PROMPT_MSG027);
                }else{
                    App.alert(LANGUAGE.COM_MSG16);
                }
                App.hidePreloader();
            },
            function(){ App.hidePreloader(); App.alert(LANGUAGE.COM_MSG02); }
        );
    });
});

App.onPageInit('profile.password', function (page) {
    $$('.saveResetPwd').on('click', function(e){
        var password = {
            old: $$(page.container).find('input[name="Password"]').val(),
            new: $$(page.container).find('input[name="NewPassword"]').val(),
            confirm: $$(page.container).find('input[name="NewPasswordConfirm"]').val()
        };

        if ($$(page.container).find('input[name="NewPassword"]').val().length >= 6) {
            if (password.new == password.confirm) {
                var userInfo = getUserinfo();
                var url = API_URL.URL_RESET_PASSWORD.format(userInfo.MinorToken,
                        encodeURIComponent(password.old),
                        encodeURIComponent(password.new)
                    );
                //console.log(url);
                App.showPreloader();
                JSON1.request(url, function(result){
                        //console.log(result);
                        if (result.MajorCode == '000') {
                            App.alert(LANGUAGE.PROMPT_MSG003, function(){
                                logout();
                            });
                        }else{
                            App.alert(LANGUAGE.PROMPT_MSG028);
                        }
                        App.hidePreloader();
                    },
                    function(){ App.hidePreloader(); App.alert(LANGUAGE.COM_MSG02); }
                );
            }else{
                App.alert(LANGUAGE.COM_MSG14);  //Passwords do not match
            }
        }else{
            App.alert(LANGUAGE.COM_MSG15); // Password should contain at least 6 characters
        }
    });
});

App.onPageInit('asset.tracking.interval', function (page) {
    var upgradeNowButton = $$(page.container).find('.upgradeNowButton');
    var rangeInput = $$(page.container).find('input[name="rangeInput"]');
    var trackingPeriod = $$(page.container).find('input[name="tracking-period"]');
    var assetImeiInput = $$(page.container).find('input[name=trackingIntervalImei]').val();
    var params = {
    	trackingIntervalEl: $$(page.container).find('.trackingInterval'),
	    trackingCostEl: $$(page.container).find('.trackingCost'),
	    upgradeNowButtonEl:  $$(page.container).find('.upgradeNowButton'),
	    /*trackingPeriodElVal: $$(page.container).find('[name="tracking-period"]:checked').val(),*/
	    bottomIndicator: $$(page.container).find('.bottom-indicator'),
	    assetImei: assetImeiInput ? assetImeiInput : TargetAsset.IMEI,
    };

    switch (countryCode){
        case 'AUS':
            params.countryCode = countryCode;
            break;
        default:
            params.countryCode = 'OTHER';
    }

    if (upgradeNowButton.data('paylink') && upgradeNowButton.data('payplancode')) {
        upgradeNowButton.removeClass('disabled');
    }else{
        upgradeNowButton.addClass('disabled');
    }

    rangeInput.on('change input', function(){
        params.value = $$(this).val();
        updateTrackingHint(params);
    });

    trackingPeriod.on('change', function(){
        params.value = rangeInput.val();
        updateTrackingHint(params);
    });

    upgradeNowButton.on('click', function(event){
        event.preventDefault();

        var paylink = $$(this).data('paylink');
        var payPlanCode = $$(this).data('payplancode');

        var url = API_URL.URL_PREUPGRADE.format(TargetAsset.IMEI,
                payPlanCode
            );

        console.log(url);
        JSON1.request(url, function(result){
                console.log(result);
                App.hidePreloader();
                if (result.MajorCode == '000') {
                    if (paylink) {
                        if (typeof navigator !== "undefined" && navigator.app) {
                            navigator.app.loadUrl(paylink, {openExternal: true});
                        } else {
                            window.open(paylink,'_blank');
                        }
                        setTimeout(function(){
                            App.modal({
                                text: LANGUAGE.PROMPT_MSG030, //LANGUAGE.PROMPT_MSG017
                                buttons: [
                                    {
                                        text: LANGUAGE.COM_MSG34,
                                        onClick: function() {
                                            App.alert(LANGUAGE.PROMPT_MSG032);
                                            mainView.router.back();
                                            //login();
                                        }
                                    },
                                    {
                                        text: LANGUAGE.COM_MSG35,
                                        onClick: function() {
                                        }
                                    },
                                ]
                            });
                        }, 3000);
                    }
                }else{
                    App.alert(LANGUAGE.PROMPT_MSG034);
                }
            },
            function(){ App.hidePreloader(); App.alert(LANGUAGE.COM_MSG02); }
        );


        return false;

    });

});

App.onPageInit('asset.alarm', function (page) {
    var alarm = $$(page.container).find('input[name = "checkbox-alarm"]');
    var allCheckboxesLabel = $$(page.container).find('label.item-content');
    var allCheckboxes = allCheckboxesLabel.find('input');
    var alarmFields = ['geolock','tilt','impact','power','input','accOff','accOn','lowBattery'];


    alarm.on('change', function(e) {
        if( $$(this).prop('checked') ){
            allCheckboxes.prop('checked', true);
        }else{
            allCheckboxes.prop('checked', false);
        }
    });

    allCheckboxes.on('change', function(e) {
        if( $$(this).prop('checked') ){
            alarm.prop('checked', true);
        }
    });

    $$('.saveAlarm').on('click', function(e){
        var alarmOptions = {
            IMEI: TargetAsset.IMEI,
            options: 0,
        };
        if (alarm.is(":checked")) {
            alarmOptions.alarm = true;
        }

        $.each(alarmFields, function( index, value ) {
            var field = $$(page.container).find('input[name = "checkbox-'+value+'"]');
            if (!field.is(":checked")) {
                alarmOptions.options = alarmOptions.options + parseInt(field.val(), 10);
            }
        });

        var userInfo = getUserinfo();
        var url = API_URL.URL_SET_ALARM.format(userInfo.MajorToken,
                userInfo.MinorToken,
                TargetAsset.IMEI,
                alarmOptions.options
            );

        App.showPreloader();
        JSON1.request(url, function(result){
                console.log(result);
                if (result.MajorCode == '000') {
                    if (result.MinorCode == '1006') {
                        showNoCreditMessage();
                    }else{
                        updateAlarmOptVal(alarmOptions);
                        mainView.router.back();
                        checkBalance();
                    }
                }else if(result.MajorCode == '100' && result.MinorCode == '1003'){
                    showRestrictedAccessMessage();
                }else if(result.MajorCode == '100' && result.MinorCode == '1006'){
                    showNoCreditMessage();
                }else{
                    App.addNotification({
                        hold: 5000,
                        message: LANGUAGE.COM_MSG16
                    });
                    checkBalance();
                }
                App.hidePreloader();
            },
            function(){ App.hidePreloader(); App.alert(LANGUAGE.COM_MSG16); }
        );

    });
});

App.onPageInit('asset.location', function (page) {
	var panoButton = $$(page.container).find('.pano_button');
    var lat = panoButton.data('lat');
    var lng = panoButton.data('lng');
    var latlng = new google.maps.LatLng(lat, lng);
	var params = {
		'lat':lat,
		'lng':lng,
	};
    showMap(params);

    StreetViewService.getPanorama({location:latlng, radius: 50}, processSVData);

    panoButton.on('click', function(){
        var params = {
            'lat': $$(this).data('lat'),
            'lng': $$(this).data('lng'),
        };
        showStreetView(params);
    });

    $$('.requestLocation').on('click', function(){
        requestAssetPosition();
    });
});

App.onPageInit('asset.track', function (page) {
    showMap();

    var posTime = $$(page.container).find('.position_time');
    //var posDir = $$(page.container).find('.position_direction');
    var posMileage = $$(page.container).find('.position_mileage');
    var posSpeed = $$(page.container).find('.position_speed');
    var posAddress = $$(page.container).find('.display_address');
    var posLatlng = $$(page.container).find('.position_latlng');
    var routeButton = $$(page.container).find('.routeButton');
    var panoButton = $$(page.container).find('.pano_button');
    var lat = panoButton.data('lat');
    var lng = panoButton.data('lng');

    var data = {
    	'posTime':posTime,
    	'posMileage':posMileage,
    	'posSpeed':posSpeed,
    	'posAddress':posAddress,
        'routeButton':routeButton,
        'panoButton':panoButton,
        'posLatlng':posLatlng,
    };

    StreetViewService.getPanorama({location:new google.maps.LatLng(lat, lng), radius: 50}, processSVData);

    /*$$('.refreshTrack').on('click', function(){
    	updateAssetData(data);
    });*/

    $$('.requestLocation').on('click', function(){
        requestAssetPosition();
    });



    trackTimer = setInterval(function(){
                updateMarkerPositionTrack(data);
            }, 60000);

    panoButton.on('click', function(){
        var params={
            'lat': $$(this).data('lat'),
            'lng': $$(this).data('lng'),
        };
        showStreetView(params);
    });

});

App.onPageBeforeRemove('asset.track', function(page){
    clearInterval(trackTimer);
    trackTimer = false;
});



App.onPageInit('asset.status', function (page) {
    var Acc = $$(page.container).find('input[name="Acc"]');
    var Voltage = $$(page.container).find('input[name="Voltage"]');
    var Battery = $$(page.container).find('input[name="Battery"]');
    var Fuel = $$(page.container).find('input[name="Fuel"]');
    var Temperature = $$(page.container).find('input[name="Temperature"]');
    var Direction = $$(page.container).find('input[name="Direction"]');
    var EngineHours = $$(page.container).find('input[name="EngineHours"]');

    $$('.requestStatus').on('click', function(){
        //App.confirm(LANGUAGE.PROMPT_MSG033, function () {
            requestAssetStatus();
        //});
    });

    //Mileage
    //Engine
    var clickedLink = '';
    var popoverHTML = '';

    if (Acc.val()) {
        $$(page.container).find('.open-acc').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG13+' - '+Acc.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG29+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (Fuel.val()) {
        $$(page.container).find('.open-fuel').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG12+' - '+Fuel.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG40+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (Voltage.val()) {
        $$(page.container).find('.open-voltage').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG06+' - '+Voltage.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG33+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (Battery.val()) {
        $$(page.container).find('.open-battery').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG11+' - '+Battery.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG32+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (Direction.val()) {
        $$(page.container).find('.open-direction').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG01+' - '+Direction.val()+'('+Direction.data('number')+')</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG37+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (EngineHours.val()) {
        $$(page.container).find('.open-engineHours').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG38+' - '+EngineHours.val()+'</p>'+
                          /*'<p>'+LANGUAGE.ASSET_STATUS_MSG32+'</p>'+           */
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }


});

App.onPageInit('asset.status.message', function (page) {
    var Acc = $$(page.container).find('input[name="Acc"]');
    var Relay = $$(page.container).find('input[name="Relay"]');
    var Charger = $$(page.container).find('input[name="Charger"]');
    var Battery = $$(page.container).find('input[name="Battery"]');
    var Power = $$(page.container).find('input[name="Power"]');
    var GPS = $$(page.container).find('input[name="GPS"]');
    var GSM = $$(page.container).find('input[name="GSM"]');
    var GPRS = $$(page.container).find('input[name="GPRS"]');
    var Direction = $$(page.container).find('input[name="Direction"]');
    var EngineHours = $$(page.container).find('input[name="EngineHours"]');
    var Mileage = $$(page.container).find('input[name="Mileage"]');

    var clickedLink = '';
    var popoverHTML = '';

    $$('.requestStatus').on('click', function(){
        requestAssetStatus();
    });

    if (Mileage.val()) {
        $$(page.container).find('.open-mileage').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG10+' - '+Mileage.val()+'</p>'+
                          /*'<p>'+LANGUAGE.ASSET_STATUS_MSG33+'</p>'+    */
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (EngineHours.val()) {
        $$(page.container).find('.open-engineHours').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG38+' - '+EngineHours.val()+'</p>'+
                          /*'<p>'+LANGUAGE.ASSET_STATUS_MSG33+'</p>'+         */
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (Power.val()) {
        $$(page.container).find('.open-power').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG21+' - '+Power.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG39+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (Acc.val()) {
        $$(page.container).find('.open-acc').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG13+' - '+Acc.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG29+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (Relay.val()) {
        $$(page.container).find('.open-relay').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG24+' - '+Relay.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG30+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (Charger.val()) {
        $$(page.container).find('.open-charger').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG25+' - '+Charger.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG31+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (Battery.val()) {
        $$(page.container).find('.open-battery').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG11+' - '+Battery.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG32+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (GPS.val()) {
        $$(page.container).find('.open-gps').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG26+' - '+GPS.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG34+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (GSM.val()) {
        $$(page.container).find('.open-gsm').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG27+' - '+GSM.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG35+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (GPRS.val()) {
        $$(page.container).find('.open-gprs').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG28+' - '+GPRS.val()+'</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG36+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }
    if (Direction.val()) {
        $$(page.container).find('.open-direction').on('click', function () {
            clickedLink = this;
            popoverHTML = '<div class="popover popover-status">'+
                          '<p class="color-dealer">'+LANGUAGE.ASSET_STATUS_MSG01+' - '+Direction.val()+'('+Direction.data('number')+')</p>'+
                          '<p>'+LANGUAGE.ASSET_STATUS_MSG37+'</p>'+
                    '</div>';
            App.popover(popoverHTML, clickedLink);
        });
    }

});


App.onPageInit('forgotPwd', function(page) {
    App.closeModal();
    $$('.backToLogin').on('click', function(){
        App.loginScreen();
    });
    $$('.sendEmail').on('click', function(){
        var email = $$(page.container).find('input[name="Email"]').val();

        if (!email) {
            App.alert(LANGUAGE.PASSWORD_FORGOT_MSG01);
        }else{
            var url = API_URL.URL_VERIFY_BY_EMAIL.format(email);
            App.showPreloader();
            JSON1.request(url, function(result){
                    console.log(result);

                    if (result.MajorCode == '000' && result.MinorCode == '0000') {
                        verifyCheck.email = email;
                        verifyCheck.CheckCode = result.Data.CheckCode;
                        mainView.router.loadPage('resources/templates/forgotPwdCode.html');
                    }else{
                        App.alert(LANGUAGE.PASSWORD_FORGOT_MSG07);
                    }

                    App.hidePreloader();
                },
                function(){ App.hidePreloader();   }
            );
        }

    });
});
App.onPageInit('forgotPwdCode', function(page) {
    $$('.sendVerifyCode').on('click', function(){
        var VerifyCode = $$(page.container).find('input[name="VerifyCode"]').val();

        if (!VerifyCode) {
            App.alert(LANGUAGE.PASSWORD_FORGOT_MSG04);
        }else{
            if (VerifyCode == verifyCheck.CheckCode) {
                mainView.router.load({
                    url:'resources/templates/forgotPwdNew.html',
                    context:{
                        Email: verifyCheck.email
                    }
                });
            }else{
                App.alert(LANGUAGE.PASSWORD_FORGOT_MSG08);
            }
        }

    });
});
App.onPageInit('forgotPwdNew', function(page) {
    $$('.sendPwdNew').on('click', function(){
        var email = $$(page.container).find('input[name="Email"]').val();
        var newPassword = $$(page.container).find('input[name="newPassword"]').val();
        var newPasswordRepeat = $$(page.container).find('input[name="newPasswordRepeat"]').val();

        if (!newPassword && newPassword.length < 6) {
            App.alert(LANGUAGE.PASSWORD_FORGOT_MSG05);
        }else{
            if (newPassword != newPasswordRepeat) {
                App.alert(LANGUAGE.PASSWORD_FORGOT_MSG10);
            }else{
                var url = API_URL.URL_FORGOT_PASSWORD.format(email,encodeURIComponent(newPassword),verifyCheck.CheckCode);
                App.showPreloader();
                JSON1.request(url, function(result){
                        if (result.MajorCode == '000' && result.MinorCode == '0000') {
                            App.alert(LANGUAGE.PASSWORD_FORGOT_MSG12);
                            $$('#account').val(email);
                            App.loginScreen();

                            /*mainView.router.back({
                              pageName: 'index',
                              force: true
                            }); */
                        }else{
                            App.alert(LANGUAGE.PASSWORD_FORGOT_MSG11);
                        }

                        App.hidePreloader();
                    },
                    function(){ App.hidePreloader();   }
                );
            }
        }

    });
});

App.onPageInit('alarms.assets', function (page) {

    var assetListContainer = $$(page.container).find('.alarmsAssetList');
    var searchForm = $$('.searchbarAlarmsAssets');
    var assetList = getAssetList();
    var newAssetlist = [];
    var keys = Object.keys(assetList);

    $.each(keys, function( index, value ) {
        assetList[value].Selected = false;
        newAssetlist.push(assetList[value]);
    });

    newAssetlist.sort(function(a,b){
        if(a.Name < b.Name) return -1;
        if(a.Name > b.Name) return 1;
        return 0;
    });

    var virtualAlarmsAssetsList = App.virtualList(assetListContainer, {
        searchAll: function (query, items) {
            var foundItems = [];
            for (var i = 0; i < items.length; i++) {
                // Check if title contains query string
                if (items[i].Name.toLowerCase().indexOf(query.toLowerCase().trim()) >= 0) foundItems.push(i);
            }
            // Return array with indexes of matched items
            return foundItems;
        },
        height: function (item) {
            return 44;
        },
        items: newAssetlist,
        renderItem: function (index, item) {
            var ret = '';


            ret +=  '<li data-index="'+index+'">';
            ret +=      '<label class="label-checkbox item-content">';
            if (item.Selected) {
                    ret +=          '<input type="checkbox" name="alarms-assets" value="" data-imei="' + item.IMEI + '" checked="true" >';
                }else{
                    ret +=          '<input type="checkbox" name="alarms-assets" value="" data-imei="' + item.IMEI + '" >';
                }
            ret +=          '<div class="item-media"><i class="icon icon-form-checkbox"></i></div>';
            ret +=          '<div class="item-inner">';
            ret +=              '<div class="item-title">' + item.Name + '</div>';
            ret +=          '</div>';
            ret +=      '</label>';
            ret +=  '</li>';

            return  ret;
        }
    });

    var searchbarAlarmsAssets = App.searchbar(searchForm, {
        searchList: '.alarmsAssetList',
        searchIn: '.alarmsAssetList .item-title',
        found: '.list-block-search-alarms-assets',
        notFound: '.searchbar-not-found-alarms-assets',
        onDisable: function(s){
            //$(s.container).slideUp();
        }
    });



    var SelectAll = $$(page.container).find('input[name="select-all"]');

    SelectAll.on('change', function(){
        var state = false;
        if( $$(this).prop('checked') ){
            state = true;
        }
        $.each(virtualAlarmsAssetsList.items, function(index, value){
            value.Selected = state;
        });
        virtualAlarmsAssetsList.replaceAllItems(virtualAlarmsAssetsList.items);
    });


    assetListContainer.on('change', 'input[name="alarms-assets"]', function(){
        var index = $$(this).closest('li').data('index');
        if (this.checked) {
            virtualAlarmsAssetsList.items[index].Selected = true;
        }else{
            virtualAlarmsAssetsList.items[index].Selected = false;
        }
    });

    $('.saveAssets').on('click', function(){
        var assets = [];
        $.each(virtualAlarmsAssetsList.items, function(index, value){
            if (value.Selected) {
                assets.push(value.IMEI);
            }
        });

        if (assets.length > 0) {

            mainView.router.load({
                url:'resources/templates/alarms.select.html',
                context:{
                    Assets: assets.toString()
                }
            });
        }else{
            App.addNotification({
                hold: 3000,
                message: LANGUAGE.PROMPT_MSG049
            });
        }

    });

});

App.onPageInit('alarms.select', function (page) {

    var alarm = $$(page.container).find('input[name = "checkbox-alarm"]');
    var allCheckboxesLabel = $$(page.container).find('label.item-content');
    var allCheckboxes = allCheckboxesLabel.find('input');
    var assets = $$(page.container).find('input[name="Assets"]').val();
    var alarmFields = ['geolock','tilt','impact','power','input','accOff','accOn','lowBattery'];

    alarm.on('change', function(e) {
        if( $$(this).prop('checked') ){
            allCheckboxes.prop('checked', true);
        }else{
            allCheckboxes.prop('checked', false);
        }
    });

    allCheckboxes.on('change', function(e) {
        if( $$(this).prop('checked') ){
            alarm.prop('checked', true);
        }
    });

    $$('.saveAlarm').on('click', function(e){
        var alarmOptions = {
            IMEI: assets,
            options: 0,
        };
        if (alarm.is(":checked")) {
            alarmOptions.alarm = true;
        }

        $.each(alarmFields, function( index, value ) {
            var field = $$(page.container).find('input[name = "checkbox-'+value+'"]');
            if (!field.is(":checked")) {
                alarmOptions.options = alarmOptions.options + parseInt(field.val(), 10);
            }
        });

        var userInfo = getUserinfo();
        var url = API_URL.URL_SET_ALARM.format(userInfo.MajorToken,
                userInfo.MinorToken,
                alarmOptions.IMEI,
                alarmOptions.options
            );

        App.showPreloader();
        JSON1.request(url, function(result){
                console.log(result);
                if (result.MajorCode == '000') {
                    if (result.MinorCode == '1006') {
                        showNoCreditMessage();
                    }else{
                        updateAlarmOptVal(alarmOptions);
                        mainView.router.back({
                            pageName: 'index',
                            force: true
                        });
                        checkBalance();
                    }
                }else if(result.MajorCode == '100' && result.MinorCode == '1006'){
                    showNoCreditMessage();
                }else if(result.MajorCode == '100' && result.MinorCode == '1003'){
                    showRestrictedAccessMessage();
                }else{
                    App.addNotification({
                        hold: 5000,
                        message: LANGUAGE.COM_MSG16
                    });
                    checkBalance();
                }
                App.hidePreloader();
            },
            function(){ App.hidePreloader(); App.alert(LANGUAGE.COM_MSG16); }
        );

    });

});


function logout(){
    clearUserInfo();
    App.loginScreen();
}



function clearUserInfo(){
    getPlusInfo();
    var deviceToken = !localStorage.PUSH_DEVICE_TOKEN ? '' : localStorage.PUSH_DEVICE_TOKEN;
    var mobileToken = !localStorage.PUSH_MOBILE_TOKEN ? '' : localStorage.PUSH_MOBILE_TOKEN;
    var elem_rc_flag = !localStorage.elem_rc_flag ? '' : localStorage.elem_rc_flag;
    var MinorToken = getUserinfo().MinorToken;
    var userName = localStorage.ACCOUNT;

    window.PosMarker = {};
    TargetAsset = {};
    POSINFOASSETLIST = {};

    var alarmList = getAlarmList();
    var pushList = getNotificationList();


    localStorage.clear();

    if (updateAssetsPosInfoTimer) {
        clearInterval(updateAssetsPosInfoTimer);
    }
    if (alarmList) {
        localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.ALARMLIST", JSON.stringify(alarmList));
    }
    if (pushList) {
        localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.NOTIFICATIONLIST", JSON.stringify(pushList));
    }
    if (virtualAssetList) {
        virtualAssetList.deleteAllItems();
    }
    if (elem_rc_flag) {
        localStorage.elem_rc_flag = 1;
    }
    if (deviceToken) {
        localStorage.PUSH_DEVICE_TOKEN = deviceToken;
    }
    if (mobileToken) {
        localStorage.PUSH_MOBILE_TOKEN = mobileToken;
    }
    if (userName) {
        $$("input[name='account']").val(userName);
    }
    //if(MinorToken){
        JSON1.request(API_URL.URL_GET_LOGOUT.format(MinorToken, deviceToken, mobileToken), function(result){
                        console.log(result);
        });
    //}
}

function preLogin(){
    hideKeyboard();
    //getPlusInfo();
    App.showPreloader();
    if  (localStorage.PUSH_DEVICE_TOKEN){
        login();
    }else{
        loginInterval = setInterval( reGetPushDetails, 500);
    }
}

function reGetPushDetails(){

    //getPlusInfo();
    if  (pushConfigRetry <= pushConfigRetryMax){
        pushConfigRetry++;
        if  (localStorage.PUSH_DEVICE_TOKEN){
            clearInterval(loginInterval);
            login();
        }
    }else{
        clearInterval(loginInterval);
        pushConfigRetry = 0;
        login();
        /*setTimeout(function(){
           App.alert(LANGUAGE.PROMPT_MSG052);
        },2000);*/
    }
}


function login(){
    getPlusInfo();
    hideKeyboard();

    //App.showPreloader();
    var mobileToken = !localStorage.PUSH_MOBILE_TOKEN ? '123' : localStorage.PUSH_MOBILE_TOKEN;
    var appKey = !localStorage.PUSH_APP_KEY ? 'RpOT2oi37K69qGaSyxDtu8' : localStorage.PUSH_APP_KEY;
    var deviceToken = !localStorage.PUSH_DEVICE_TOKEN ? '123' : localStorage.PUSH_DEVICE_TOKEN;
    var deviceType = !localStorage.DEVICE_TYPE ? 'android' : localStorage.DEVICE_TYPE;
    var account = $$("input[name='account']");
    var password = $$("input[name='password']");

    var urlLogin = API_URL.URL_GET_LOGIN.format(!account.val() ? localStorage.ACCOUNT : account.val()
                                     , encodeURIComponent(!password.val() ? localStorage.PASSWORD : password.val())
                                     , appKey
                                     , mobileToken
                                     , encodeURIComponent(deviceToken)
                                     , deviceType);
                          //console.log(urlLogin);
    JSON1.request(urlLogin, function(result){
            App.hidePreloader();
            console.log(result);
            if(result.MajorCode == '000') {
                if (result.Data.elemRc) {
                    localStorage.elem_rc_flag = 1;
                    //localStorage.removeItem('elem_rc_flag');
                }
                if(account.val()) {
                    localStorage.ACCOUNT = account.val().trim().toLowerCase();
                    localStorage.PASSWORD = password.val();
                }
                account.val(null);
                password.val(null);
                setUserinfo(result.Data);
                setAssetList(result.Data.AssetArray);
                updateUserCrefits(result.Data.UserInfo.SMSTimes);
                updateMenuUserData(result.Data.UserInfo);
                updateSupportUrl();


                getNewNotifications();
                App.closeModal();

            }else {
                App.alert(LANGUAGE.LOGIN_MSG01);
                App.loginScreen();
            }
        },
        function(){ App.hidePreloader(); App.alert(LANGUAGE.COM_MSG02);App.loginScreen();  }
    );

}

function getNewData(){
    //alert('here');
    getPlusInfo();
    //hideKeyboard();

    var mobileToken = !localStorage.PUSH_MOBILE_TOKEN? '111' : localStorage.PUSH_MOBILE_TOKEN;
    var appKey = !localStorage.PUSH_APP_KEY? '111' : localStorage.PUSH_APP_KEY;
    var deviceToken = !localStorage.PUSH_DEVICE_TOKEN? '111' : localStorage.PUSH_DEVICE_TOKEN;
    var deviceType = !localStorage.DEVICE_TYPE? 'android' : localStorage.DEVICE_TYPE;

   // alert('logged in');

    var urlLogin = API_URL.URL_GET_LOGIN.format(localStorage.ACCOUNT,
                                     encodeURIComponent(localStorage.PASSWORD),
                                     appKey,
                                     mobileToken,
                                     encodeURIComponent(deviceToken),
                                     deviceType);
    //alert(urlLogin);
    //console.log(urlLogin);
    JSON1.request(urlLogin, function(result){
           console.log(result);
            if(result.MajorCode == '000') {
                setUserinfo(result.Data);
                //setAssetList(result.Data.Devices);
                updateUserCredits(result.Data.UserInfo.SMSTimes);
                if (result.Data.AssetArray) {
                    updateAssetList2(result.Data.AssetArray);
                }

            }
        },
        function(){  }
    );


}

function refreshToken(newDeviceToken){
    console.log('refreshToken() called');
    var userInfo = getUserinfo();

    if (localStorage.PUSH_MOBILE_TOKEN && userInfo.MajorToken && userInfo.MinorToken && newDeviceToken) {
        var data = {
            MajorToken: userInfo.MajorToken,
            MinorToken: userInfo.MinorToken,
            MobileToken: localStorage.PUSH_MOBILE_TOKEN,
            DeviceToken: newDeviceToken,
        };

        //console.log(urlLogin);
        JSON1.requestPost(API_URL.URL_REFRESH_TOKEN, data, function(result){
                if(result.MajorCode == '000') {

                }else{

                }
            },
            function(){ console.log('error during refresh token');  }
        );
    }else{
        console.log('not loggined');
    }

}

function hideKeyboard() {
    document.activeElement.blur();
    $$("input").blur();
}

function updateMenuUserData(data) {
    var letter1 = '';
    var letter2 = '';
    if (data.FirstName) {
        data.FirstName = $.trim(data.FirstName);
        letter1 = data.FirstName[0].toUpperCase();
    }
    if (data.SurName) {
        data.SurName = $.trim(data.SurName);
        letter2 = data.SurName[0].toUpperCase();
    }
    $$('.user_f_l').html(letter1+letter2);
    $$('.user_name').html(data.FirstName+' '+data.SurName);

    $$('.user_email').html(data.Email);
}

function init_AssetList() {
    var assetList = getAssetList();

    var newAssetlist = [];
    var keys = Object.keys(assetList);
    for (var i = 0, len = keys.length; i < len; i++) {
      newAssetlist.push(assetList[keys[i]]);
    }

    newAssetlist.sort(function(a,b){
        if(a.Name < b.Name) return -1;
        if(a.Name > b.Name) return 1;
        return 0;
    });

    returnToIndex();
    //console.log(newAssetlist);

    virtualAssetList.replaceAllItems(newAssetlist);
    initExtend();

    setTimeout(function(){
        updateAssetsPosInfoTimer = setInterval(function(){
            updateAssetsPosInfo();
        }, 60000);
    }, 60000);

    //console.log(assetList);


}


var elem_rc =   '<li class="item-content list-panel-all close-panel item-link color-red" id="menuRechargeCredit" style="display:none;">' +
                   '<div class="item-media">' +
                        '<i class="f7-icons icon-menu-recharge-credit color-red"></i>' +
                    '</div>' +
                    '<div class="item-inner">' +
                        '<div class="item-title color-black">' + LANGUAGE.MENU_MSG02 + '</div>' +
                    '</div>' +
                '</li>';
$$(elem_rc).insertAfter('#menuHome');

var elem_rc =   '<div class="menu_remainings" style="display:none;">' +
                    LANGUAGE.COM_MSG30 + ': <span class="remaining_counter">-</span> ' + LANGUAGE.COM_MSG31 +
                '</div>';
$$(elem_rc).insertAfter('#menu');

function initExtend(){
    if ($$("#menuRechargeCredit").length !== 0 && localStorage.elem_rc_flag) {
        $$('body').find('#menuRechargeCredit').css('display', 'flex');
    }
    if ($$(".menu_remainings").length !== 0 && localStorage.elem_rc_flag) {
        $$('body').find('.menu_remainings').css('display', 'block');
    }
}


function initSearchbar(searchContainer){
    if (!searchContainer) {
        if (searchbar) {
            searchbar.destroy();
        }
        searchbar = App.searchbar('.searchbar', {
            searchList: '.list-block-search',
            searchIn: '.item-title',
            found: '.searchbar-found',
            notFound: '.searchbar-not-found',
            onDisable: function(s){
                //$(s.container).slideUp();
            }
        });
    }else{

    }

}
function returnToIndex(){
    mainView.router.back({
      pageName: 'index',
      force: true
    });
}

function updateUserCrefits(credits){
    $$('body .remaining_counter').html(credits);

    setTimeout(function() {
        checkIsBalanceLow(credits);
    }, 1000);
}

function checkIsBalanceLow(val) {
    if (val < 6 ) {
        var modalTex = '<div class="color-red custom-modal-title">'+ LANGUAGE.PROMPT_MSG045 +'</div>' +
                        '<div class="custom-modal-text">'+ LANGUAGE.PROMPT_MSG044 +'</div>' +
                        '<div class="custom-modal-text">'+ LANGUAGE.PROMPT_MSG046 +'</div>' +
                        '<div class="menu_remainings custom-modal-remaining">' +
                            LANGUAGE.COM_MSG30 + ': <span class="remaining_counter">' + val + '</span> '+LANGUAGE.COM_MSG31 +
                        '</div>';

        switch (true){
            /*case ( val > 1 && val < 6 ):
                modalTex = '<div class="color-red custom-modal-title">'+ LANGUAGE.PROMPT_MSG025 +'</div>' +
                            '<div class="custom-modal-text">'+ LANGUAGE.PROMPT_MSG024 +'</div>' +
                            '<div class="custom-modal-text">'+ LANGUAGE.PROMPT_MSG026 +'</div>' +
                            '<div class="remaining_wrapper custom-modal-remaining">' +
                                '<p>'+ LANGUAGE.COM_MSG01 + ': <span class="user_credits">' + val + '</span></p>' +
                            '</div>';
                break;*/
            case ( val < 2 ):
                modalTex = '<div class="color-red custom-modal-title">'+ LANGUAGE.PROMPT_MSG047 +'</div>' +
                            '<div class="custom-modal-text">'+ LANGUAGE.PROMPT_MSG048 +'</div>' +
                            '<div class="custom-modal-text">'+ LANGUAGE.PROMPT_MSG046 +'</div>';
                break;

        }

        App.modal({
               title: '<div class="custom-modal-logo-wrapper"><img class="custom-modal-logo" src="resources/images/logo_dark.png" alt=""/></div>',
                text: modalTex,

             buttons: [
                {
                    text: LANGUAGE.COM_MSG35
                },
                {
                    text: LANGUAGE.COM_MSG34,
                    //bold: true,
                    onClick: function () {
                        loadPageRechargeCredit();
                    }
                },
            ]
        });
    }
}

function setAssetList(list){
    var ary = {};
    for(var i = 0; i < list.length; i++) {
        var index = 0;
        ary[list[i][1]] = {
            Id: list[i][index++],
            IMEI: list[i][index++],
            Name: list[i][index++],
            TagName: list[i][index++],
            Icon: list[i][index++],
            Unit: list[i][index++],
            InitMileage: list[i][index++],
            InitAcconHours: list[i][index++],
            State: list[i][index++],
            ActivateDate: list[i][index++],
            PayPlanName: list[i][index++],
            PRDTName: list[i][index++],
            PRDTFeatures: list[i][index++],
            PRDTAlerts: list[i][index++],
            Describe1: list[i][index++],
            Describe2: list[i][index++],
            Describe3: list[i][index++],
            Describe4: list[i][index++],
            Describe5: list[i][index++],
            _FIELD_FLOAT1: list[i][index++],
            _FIELD_FLOAT2: list[i][index++],
            _FIELD_FLOAT7: list[i][index++],
            Describe7: list[i][index++],
            AlarmOptions: list[i][index++],
            StatusNew: list[i][index++],
            _FIELD_FLOAT8: list[i][index++],
        };
    }
    setAssetListPosInfo(ary);
    localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.ASSETLIST", JSON.stringify(ary));
    //console.log(ary);
}
function updateAssetList(asset){
    var list = getAssetList();

    POSINFOASSETLIST[asset.IMEI].IMEI = list[asset.IMEI].IMEI = asset.IMEI;
    POSINFOASSETLIST[asset.IMEI].Name = list[asset.IMEI].Name = asset.Name;
    POSINFOASSETLIST[asset.IMEI].TagName = list[asset.IMEI].TagName = asset.Tag;
    POSINFOASSETLIST[asset.IMEI].Unit = list[asset.IMEI].Unit = asset.Unit;
    POSINFOASSETLIST[asset.IMEI].InitMileage = list[asset.IMEI].InitMileage = asset.Mileage;
    POSINFOASSETLIST[asset.IMEI].InitAcconHours = list[asset.IMEI].InitAcconHours = asset.Runtime;
    POSINFOASSETLIST[asset.IMEI].Describe1 = list[asset.IMEI].Describe1 = asset.Describe1;
    POSINFOASSETLIST[asset.IMEI].Describe2 = list[asset.IMEI].Describe2 = asset.Describe2;
    POSINFOASSETLIST[asset.IMEI].Describe3 = list[asset.IMEI].Describe3 = asset.Describe3;
    POSINFOASSETLIST[asset.IMEI].Describe4 = list[asset.IMEI].Describe4 = asset.Describe4;
    if (asset.Icon) {
        POSINFOASSETLIST[asset.IMEI].Icon = list[asset.IMEI].Icon = asset.Icon +'?'+ new Date().getTime();
    }

    localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.ASSETLIST", JSON.stringify(list));
}
function updateAssetList2(asset){
    var list = getAssetList();
    var imei = asset[1];
    if (list[imei]) {
        var index = 0;
        list[imei] = {
            Id: asset[index++],
            IMEI: asset[index++],
            Name: asset[index++],
            TagName: asset[index++],
            Icon: asset[index++],
            Unit: asset[index++],
            InitMileage: asset[index++],
            InitAcconHours: asset[index++],
            State: asset[index++],
            ActivateDate: asset[index++],
            PayPlanName: asset[index++],
            PRDTName: asset[index++],
            PRDTFeatures: asset[index++],
            PRDTAlerts: asset[index++],
            Describe1: asset[index++],
            Describe2: asset[index++],
            Describe3: asset[index++],
            Describe4: asset[index++],
            Describe5: asset[index++],
            _FIELD_FLOAT1: asset[index++],
            _FIELD_FLOAT2: asset[index++],
            _FIELD_FLOAT7: asset[index++],
            Describe7: asset[index++],
            AlarmOptions: asset[index++],
            StatusNew: asset[index++],
            _FIELD_FLOAT8: asset[index++],
        };

        if (POSINFOASSETLIST[list[i][1]]) {
            POSINFOASSETLIST[list[i][1]].StatusNew =  ary[list[i][1]].StatusNew;
        }

        localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.ASSETLIST", JSON.stringify(list));
    }

}

function updateAssetList3(asset){
    var list = getAssetList();
    var imei = asset[1];
    if (list[imei]) {
        var index = 0;
        list[imei] = {
            Id: asset[index++],
            IMEI: asset[index++],
            Name: asset[index++],
            TagName: asset[index++],
            Icon: asset[index++],
            Unit: asset[index++],
            InitMileage: asset[index++],
            InitAcconHours: asset[index++],
            State: asset[index++],
            ActivateDate: asset[index++],
            PayPlanName: asset[index++],
            PRDTName: asset[index++],
            PRDTFeatures: asset[index++],
            PRDTAlerts: asset[index++],
            Describe1: asset[index++],
            Describe2: asset[index++],
            Describe3: asset[index++],
            Describe4: asset[index++],
            Describe5: asset[index++],
            _FIELD_FLOAT1: asset[index++],
            _FIELD_FLOAT2: asset[index++],
            _FIELD_FLOAT7: asset[index++],
            Describe7: asset[index++],
            AlarmOptions: asset[index++],
            StatusNew: asset[index++],
            _FIELD_FLOAT8: asset[index++],
        };

        localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.ASSETLIST", JSON.stringify(list));
    }

}
function getAssetList(){
    var ret = null;var str = localStorage.getItem("COM.QUIKTRAK.QUIKLOC8.ASSETLIST");if(str){ret = JSON.parse(str);}return ret;
}

function setAlarmList(options){
    var list = getAlarmList();
    if (!list) {
        list = {};
    }
    list[options.IMEI]={
        IMEI: options.IMEI,
        Alarm: options.Alarm,
        Geolock: options.Geolock,
        Tilt: options.Tilt,
        Impact: options.Impact,
        Power: options.Power
    };
    console.log(list);

    localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.ALARMLIST", JSON.stringify(list));
}
function getAlarmList(){
    var ret = null;var str = localStorage.getItem("COM.QUIKTRAK.QUIKLOC8.ALARMLIST");if(str){ret = JSON.parse(str);}return ret;
}


function setAssetListPosInfo(listObj){
    var userInfo = getUserinfo();

    var codes = '';
    $.each(listObj, function(index, val){
        codes += val.Id+',';
    });
    if (codes) {
        codes = codes.slice(0, -1);
    }
    var url = API_URL.URL_GET_ALL_POSITIONS.format(userInfo.MinorToken,userInfo.MajorToken);
    var data = {
        'codes': codes,
    };
    //console.log(data);
    JSON1.requestPost(url,data, function(result){
            //console.log(result);
            if (result.MajorCode == '000') {
                var data = result.Data;
                if (result.Data) {
                     $.each( result.Data, function( key, value ) {
                        var posData = value;
                        var imei = posData[1];
                        var protocolClass = posData[2];
                        var deviceInfo = listObj[imei];

                        POSINFOASSETLIST[imei] = Protocol.ClassManager.get(protocolClass, deviceInfo);
                        POSINFOASSETLIST[imei].initPosInfo(posData);

                    });
                }

                //console.log(POSINFOASSETLIST);

                App.hidePreloader();
            }else{
                //console.log(result);
            }
            init_AssetList();
            initSearchbar();
        },
        function(){ }
    );
}

function updateAssetsPosInfo(){
    var userInfo = getUserinfo();
    var assetList = getAssetList();
    var codes = '';
    $.each(assetList, function(index, val){
        codes += val.Id+',';
    });
    if (codes) {
        codes = codes.slice(0, -1);
    }

    var url = API_URL.URL_GET_ALL_POSITIONS.format(userInfo.MinorToken,userInfo.MajorToken);
    var data = {
        'codes': codes,
    };

    JSON1.requestPost(url,data, function(result){

            //console.log(result);
            if (result.MajorCode == '000') {
                var data = result.Data;
                var posData = '';
                var imei = '';
                $.each( data, function( key, value ) {
                    posData = value;
                    imei = posData[1];
                    if (POSINFOASSETLIST[imei] && !POSINFOASSETLIST[imei].posInfo.positionTime || POSINFOASSETLIST[imei] && posData[5] >= POSINFOASSETLIST[imei].posInfo.positionTime._i ) {
                        POSINFOASSETLIST[imei].initPosInfo(posData);
                    }

                });
                updateAssetsListStats();
            }
        },
        function(){ }
    );
}


function requestAssetPosition(){
    var userInfo = getUserinfo();
    var timeZone = moment().utcOffset() / 60;

    var url = API_URL.URL_SEND_COM_POS.format(userInfo.MinorToken,
        TargetAsset.IMEI,
        timeZone
    );

    console.log(url);

    App.showPreloader();
    JSON1.request(url, function(result){
            console.log(result);
            App.hidePreloader();
            if(result.length > 0 || result.ERROR == "ARREARS"){
                if (DEMOACCONTS.indexOf(localStorage.ACCOUNT.trim().toLowerCase()) > -1)  {
                    showRestrictedAccessMessage();
                } else{
                    showNoCreditMessage();
                }
            }else if(result.ERROR == "LOCKED"){
                showModalMessage(TargetAsset.IMEI, LANGUAGE.PROMPT_MSG054);
            }else{
                App.addNotification({
                    hold: 2000,
                    message: LANGUAGE.COM_MSG03
                });
                checkBalance();
            }

        }, function(result){
            App.hidePreloader();
            App.alert(LANGUAGE.COM_MSG02);
        }
    );
}

function requestAssetStatus(){
    var userInfo = getUserinfo();

    var url = API_URL.URL_SEND_COM_STATUS.format(userInfo.MinorToken,
            TargetAsset.IMEI
        );

    App.showPreloader();
    JSON1.request(url, function(result){
            App.hidePreloader();
            if(result.length > 0 || result.ERROR == "ARREARS"){
                if (DEMOACCONTS.indexOf(localStorage.ACCOUNT.trim().toLowerCase()) > -1)  {
                    showRestrictedAccessMessage();
                } else{
                    showNoCreditMessage();
                }
            }else if(result.ERROR == "LOCKED"){
                showModalMessage(TargetAsset.IMEI, LANGUAGE.PROMPT_MSG054);
            }else{
                App.addNotification({
                    hold: 2000,
                    message: LANGUAGE.COM_MSG03
                });
                checkBalance();
            }

        }, function(result){
            App.hidePreloader();
            App.alert(LANGUAGE.COM_MSG02);
        }
    );
}

function changeState(params){
    if (params && params.clickedButton && params.buttons && params.stateFor) {
        var clickedState = $$(params.clickedButton).data('state');
        var userInfo = getUserinfo();

        var url = API_URL.URL_SET_GEOLOCK;
        if (params.stateFor == 'immob') {
            url = API_URL.URL_SET_IMMOBILISATION;
        }
        url = url.format(userInfo.MajorToken,
            userInfo.MinorToken,
            TargetAsset.ID,
            clickedState);

        console.log(url);
        App.showPreloader();
        JSON1.request(url, function(result){
                App.hidePreloader();
                //console.log(result);

                if(result.MajorCode == '000'){
                    params.buttons.toggleClass('disabled');
                    checkBalance();
                    getNewAssetInfo({'id':TargetAsset.ID});
                }else if(result.MajorCode == '200' && result.MinorCode == '1003'){
                    /*App.confirm(LANGUAGE.PROMPT_MSG029, function () {     // "PROMPT_MSG004":"The balance is insufficient, please renew",
                        loadPageRechargeCredit();
                    }); */
                    showNoCreditMessage();
                }else if(result.MajorCode == '100' && result.MinorCode == '1003'){
                    showRestrictedAccessMessage();
                }else{
                    App.alert(LANGUAGE.COM_MSG36);
                }

            },
            function(){ App.hidePreloader(); App.alert(LANGUAGE.COM_MSG02); }
        );
    }
}

function getAssetImg(params, imgFor){
    var assetImg = '';
    var pattern = /^IMEI_/i;
    var splitted = '';
    if (params && imgFor.assetList) {
        if (params.Icon && pattern.test(params.Icon)) {
            assetImg = '<img class="item_asset_img" src="http://upload.quiktrak.co/Attachment/images/'+params.Icon+'?'+ new Date().getTime()+'alt="">';
        }else if (params.Name) {
            params.Name = $.trim(params.Name);
            splitted = params.Name.split(' ');
            if (splitted.length > 1) {
                var one = '';
                var two = '';
                for (var i = 0; i < splitted.length; i++) {
                    if (splitted[i] && splitted[i][0]) {
                        if (!one || !two) {
                            if (!one) {
                                one = splitted[i][0];
                            }else{
                                two = splitted[i][0];
                                break;
                            }
                        }
                    }
                }
                assetImg = '<div class="item_asset_img bg-dealer"><div class="text-a-c vertical-center user_f_l fs-24 color-white">'+one+two+'</div></div>';
            }else{
                assetImg = '<div class="item_asset_img bg-dealer"><div class="text-a-c vertical-center user_f_l fs-24 color-white">'+params.Name[0]+params.Name[1]+'</div></div>';
            }

        }else if(params.IMEI){
            assetImg = '<div class="item_asset_img bg-dealer"><div class="text-a-c vertical-center user_f_l fs-24 color-white">'+params.IMEI[0]+params.IMEI[1]+'</div></div>';
        }
    }else if (params && imgFor.statusPage) {
        if (params.Icon && pattern.test(params.Icon)) {
            assetImg = 'http://upload.quiktrak.co/Attachment/images/'+params.Icon+'?'+ new Date().getTime();
        }else{
            assetImg = false;
        }
    }else if (params && imgFor.assetPage) {
        if (params.Icon && pattern.test(params.Icon)) {
            assetImg = '<img class="item_asset_img" src="http://upload.quiktrak.co/Attachment/images/'+params.Icon+'?'+ new Date().getTime()+'alt="">';
        }else if (params.Name) {
            params.Name = $.trim(params.Name);
            splitted = params.Name.split(' ');
            if (splitted.length > 1) {
                assetImg = '<div class="item_asset_img bg-dealer"><div class="text-a-c vertical-center user_f_l fs-3 color-white">'+splitted[0][0]+splitted[1][0]+'</div></div>';
            }else{
                assetImg = '<div class="item_asset_img bg-dealer"><div class="text-a-c vertical-center user_f_l fs-3 color-white">'+params.Name[0]+params.Name[1]+'</div></div>';
            }

        }else if(params.IMEI){
            assetImg = '<div class="item_asset_img bg-dealer"><div class="text-a-c vertical-center user_f_l fs-3 color-white">'+params.IMEI[0]+params.IMEI[1]+'</div></div>';
        }

    }else{
        assetImg = false;
    }
    //console.log(assetImg);
    return assetImg;
}

function loadPageProfile(){
    var userInfo = getUserinfo().UserInfo;
    console.log(userInfo);
    mainView.router.load({
        url:'resources/templates/profile.user.html',
        context:userInfo,
    });
}

function loadPagePassword(){
    mainView.router.load({
        url:'resources/templates/profile.password.html',

    });
}

function loadPageAsset(){
    var assetList = getAssetList();
    //var asset = POSINFOASSETLIST[TargetAsset.IMEI];
    var asset = assetList[TargetAsset.IMEI];
    var assetImg = getAssetImg(asset, {'assetPage':true});

    //var userInfo = getUserinfo();
    var remainings = getUserinfo().UserInfo.SMSTimes;
    //console.log(asset);
    var geolockState = false;
    var immobiliseState = false;
    //console.log(asset);
    //console.log(asset.StatusNew);
    if (typeof asset !== "undefined") {
    	if ((parseInt(asset.StatusNew) & 1) > 0) {
	        geolockState = true;
	    }
	    if ((parseInt(asset.StatusNew) & 2) > 0) {
	        immobiliseState = true;
	    }
    }



    mainView.router.load({
        url:'resources/templates/asset.html',
        context:{
            AssetImg: assetImg,
            Name: TargetAsset.Name,
            Remainings: remainings,
            Geolock: geolockState,
            Immobilise: immobiliseState,
            rcFlag: localStorage.elem_rc_flag,
        }

    });
}


function loadPageRechargeCredit(){
    var MinorToken = getUserinfo().MinorToken;
    //var CountryCode = getUserinfo().UserInfo.CountryCode;

    /*AUS*/
    /*var buttons = {
        'button10' : 'KPF23R37HEJAC',
        'button50' : 'QYHM382HALQBG',
        'button100' : '7GB5ZBQQU5RAY',
        'buttonCur' : 'AUD'
    };  */

    var buttons = {
        'button10' : 'XTKUPGEYWZ3T4',
        'button50' : 'KWC3YWFGZTW28',
        'button100' : 'QTULPNEWWN6CN',
        'buttonCur' : 'USD'
    };

    /*switch (CountryCode){
        case 'USA':
            buttons.button10  = 'XTKUPGEYWZ3T4';
            buttons.button50  = 'KWC3YWFGZTW28';
            buttons.button100 = 'QTULPNEWWN6CN';
            buttons.buttonCur = 'USD';
            break;
        case 'CAN':
            buttons.button10  = 'FSMSLCFUPE954';
            buttons.button50  = 'GFBCR2TX9XEJL';
            buttons.button100 = 'MFCNEYY4R5WHG';
            buttons.buttonCur = 'CAD';
            break;
    }*/

    mainView.router.load({
        url: 'resources/templates/user.recharge.credit.html',
        context:{
            userCode: MinorToken,
            dealerNumber: AppDetails.code,    // 2 - means M-Protekt
            other: AppDetails.name,
            button10: buttons.button10,
            button50: buttons.button50,
            button100: buttons.button100,
            buttonCur: buttons.buttonCur
        },

    });
}

function checkBalanceAndLoadPage(pageName){
    if (pageName) {
        var userInfo = getUserinfo();
        var url = API_URL.URL_GET_BALANCE.format(userInfo.MajorToken, userInfo.MinorToken);

        JSON1.request(url, function(result){
            if (result.MajorCode == '000') {
                userInfo.UserInfo.SMSTimes = result.Data.SMSTimes;
                setUserinfo(userInfo);
                if (result.Data.SMSTimes < 1) {
                    showNoCreditMessage();
                }else{
                    switch (pageName){
                        case 'asset.alarm':
                            loadPageAssetAlarm();
                            break;
                        case 'alarms.assets':
                            mainView.router.load({
                                url:'resources/templates/alarms.assets.html',
                            });
                            break;
                    }

                    updateUserCrefits(result.Data.SMSTimes);
                }

            }
        },
        function(){ });
    }
}

function showNoCreditMessage(){
    var modalTex = '<div class="color-red custom-modal-title">'+ LANGUAGE.PROMPT_MSG047 +'</div>' +
                    '<div class="custom-modal-text">'+ LANGUAGE.PROMPT_MSG029 +'</div>';
    App.modal({
           title: '<div class="custom-modal-logo-wrapper"><img class="custom-modal-logo" src="resources/images/logo_dark.png" alt=""/></div>',
            text: modalTex,
         buttons: [
            {
                text: LANGUAGE.COM_MSG35
            },
            {
                text: LANGUAGE.COM_MSG34,
                //bold: true,
                onClick: function () {
                    loadPageRechargeCredit();
                }
            },
        ]
    });
}

function showRestrictedAccessMessage(){
    var modalTex = '<div class="color-red custom-modal-title">'+ LANGUAGE.PROMPT_MSG050 +'</div>' +
                    '<div class="custom-modal-text">'+ LANGUAGE.PROMPT_MSG051 +'</div>';
    App.modal({
           title: '<div class="custom-modal-logo-wrapper"><img class="custom-modal-logo" src="resources/images/logo_dark.png" alt=""/></div>',
            text: modalTex,
         buttons: [
            {
                text: LANGUAGE.COM_MSG38
            }
        ]
    });
}

function showModalMessage(header, body){
    var modalTex = '<div class="color-red custom-modal-title">'+ header +'</div>' +
                    '<div class="custom-modal-text">'+ body +'</div>';
    App.modal({
           title: '<div class="custom-modal-logo-wrapper"><img class="custom-modal-logo" src="resources/images/logo_dark.png" alt=""/></div>',
            text: modalTex,
         buttons: [
            {
                text: LANGUAGE.COM_MSG38
            },

        ]
    });
}

function loadPageAssetAlarm(){
    var assetList = getAssetList();
    var asset = assetList[TargetAsset.IMEI];
    var assetAlarmVal = assetList[TargetAsset.IMEI].AlarmOptions;
    var alarms = {
        alarm: {
            state: true,
            //val: 0,
        },
        geolock: {
            state: true,
            val: 1024,
        },
        tilt: {
            state: true,
            val: 256,
        },
        impact: {
            state: true,
            val: 16384,
        },
        power: {
            state: true,
            val: 4,
        },
        input: {
            state: true,
            val: 131072,
        },
        accOff: {
            state: true,
            val: 65536,
        },
        accOn: {
            state: true,
            val: 32768,
        },
        lowBattery: {
            state: true,
            val: 512,
        }
    };
    if (assetAlarmVal) {
        $.each( alarms, function ( key, value ) {
            if (assetAlarmVal & value.val) {
                alarms[key].state = false;
            }
        });
        if (assetAlarmVal == 247556) {
            alarms.alarm.state = false;
        }

    }
    mainView.router.load({
        url:'resources/templates/asset.alarm.html',
        context:{
            Name: asset.Name,
            Alarm: alarms.alarm.state,
            Geolock: alarms.geolock.state,
            Tilt: alarms.tilt.state,
            Impact: alarms.impact.state,
            Power: alarms.power.state,
            Input: alarms.input.state,
            AccOff: alarms.accOff.state,
            AccOn: alarms.accOn.state,
            LowBattery: alarms.lowBattery.state,
        }
    });
}

function updateAlarmOptVal(alarmOptions) {
    var IMEIList = alarmOptions.IMEI.split(',');
    var assetList = getAssetList();

    if (IMEIList) {
        $.each(IMEIList, function(index, value){
            assetList[value].AlarmOptions = alarmOptions.options;
        });
    }

    localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.ASSETLIST", JSON.stringify(assetList));
}

function updateSupportUrl(){
	var userInfo = getUserinfo().UserInfo;

	var param = {
		'name': '',
		'loginName':'',
		'email':'',
		'phone':'',
    'service': AppDetails.supportCode, //means quikloc8.co in support page
	};

	if (userInfo.FirstName) {
		param.name = userInfo.FirstName.trim();
	}
	if (userInfo.SurName) {
		param.name = param.name + ' ' + userInfo.SurName.trim();
		param.name = param.name.trim();
	}
	if (localStorage.ACCOUNT) {
		param.loginName = localStorage.ACCOUNT.trim();
        param.loginName = encodeURIComponent(param.loginName);
	}
	if (userInfo.Email) {
		param.email = userInfo.Email.trim();
        param.email = encodeURIComponent(param.email);
	}
	if (userInfo.Mobile) {
		param.phone = userInfo.Mobile.trim();
        param.phone = encodeURIComponent(param.phone);
	}

	//API_URL.URL_SUPPORT = "http://support.quiktrak.eu/?name={0}&loginName={1}&email={2}&phone={3}";
	//var href = API_URL.URL_SUPPORT;
    if (param.name) {
        param.name = encodeURIComponent(param.name);
    }
	var href = API_URL.URL_SUPPORT.format(param.name,param.loginName,param.email,param.phone,param.service);
    //console.log(href);
	$$('#menuSupport').attr('href',href);
	/*if (typeof navigator !== "undefined" && navigator.app) {
            navigator.app.loadUrl(href, {openExternal: true});
        } else {
            window.open(href,'_blank');
        }
    }*/
}

function checkBalance(alert){
    App.showPreloader();
    var userInfo = getUserinfo();
    var url = API_URL.URL_GET_BALANCE.format(userInfo.MajorToken, userInfo.MinorToken);
    JSON1.request(url, function(result){
            //console.log(result);
            if (result.MajorCode == '000') {
                userInfo.UserInfo.SMSTimes = result.Data.SMSTimes;
                setUserinfo(userInfo);
                if (alert) {
                    App.alert(LANGUAGE.PROMPT_MSG031+': '+result.Data.SMSTimes);
                }
                //$$('body .remaining_counter').html(result.Data.SMSTimes);
                updateUserCrefits(result.Data.SMSTimes);
            }
            App.hidePreloader();
        },
        function (){App.hidePreloader();App.alert(LANGUAGE.COM_MSG02);}
    );
}

function getNewAssetInfo(params){

    var MinorToken = getUserinfo().MinorToken;
    var url = API_URL.URL_GET_ASSET_DETAILS.format(MinorToken, params.id);
    JSON1.request(url, function(result){
            console.log(result);
            if (result.MajorCode == '000') {
                if (result.Data) {
                    updateAssetList3(result.Data);
                }
            }
            //App.hidePreloader();
        },
        function (){ }
    );
}

function updateTrackingHint(params){
    var trackingPeriodElVal = $$('body').find('[name="tracking-period"]:checked').val();

    if (parseInt(Protocol.TrackingInterval[params.value][trackingPeriodElVal][params.countryCode].cost) === 0) {
        params.upgradeNowButtonEl.addClass('disabled');
    }else{
        params.upgradeNowButtonEl.removeClass('disabled');
    }
    params.bottomIndicator.removeClass('color-dealer');
    $$('.bottom-indicator-'+params.value).addClass('color-dealer');

    params.trackingIntervalEl.html(Protocol.TrackingInterval[params.value].intervalDisplayed);
    params.trackingCostEl.html(Protocol.TrackingInterval[params.value][trackingPeriodElVal][params.countryCode].cost);
    params.upgradeNowButtonEl.data('paylink',Protocol.TrackingInterval[params.value][trackingPeriodElVal][params.countryCode].button+'&on0=imei&os0='+params.assetImei+'&on1=dn&os1='+AppDetails.code+'&on2=appname&os2='+AppDetails.name);
    params.upgradeNowButtonEl.data('payplancode',Protocol.TrackingInterval[params.value][trackingPeriodElVal][params.countryCode].payPlanCode);

}

function getTrackingIntervalDetailByCountyCode(countryCode){
    var ret = {
        cost: 0,
        payLink: '',
        payPlanCode: '',
    };
    switch(countryCode){
        case 'AUS':
            ret.cost = Protocol.TrackingInterval[0][1][countryCode].cost;
            ret.payLink = Protocol.TrackingInterval[0][1][countryCode].button;
            ret.payPlanCode = Protocol.TrackingInterval[0][1][countryCode].payPlanCode;
            break;
    }
    return ret;
}


function checkMapExisting(){
    if ($$('#map')) {
        $$('#map').remove();
        MapTrack = null;
    }
}

function updateAssetData(parameters){
    var userInfo = getUserinfo();
    var url = API_URL.URL_GET_POSITION.format(userInfo.MinorToken,TargetAsset.ID);

    var container = $$('body');
    if (container.children('.progressbar, .progressbar-infinite').length) return; //don't run all this if there is a current progressbar loading
    App.showProgressbar(container);

    JSON1.request(url, function(result){

            if (result.MajorCode == '000' ) {
                if (result.Data) {

                    var posData = result.Data.Pos;
                    if (posData) {
                        var imei = posData[1];
                        var posTime = posData[5];
                        if (POSINFOASSETLIST[imei] && posTime > POSINFOASSETLIST[imei].posInfo.positionTime._i) {
                            POSINFOASSETLIST[imei].initPosInfo(posData);
                        }
                    }

                    setTimeout(function(){
                        updateMarkerPositionTrack(parameters);
                        App.hideProgressbar();
                    },500);
                    updateAssetsListStats();

                }
            }else{
                App.hideProgressbar();
            }
        },
        function(){
            App.hideProgressbar();
        }
    );
}

function updateMarkerPositionTrack(data){
        var asset = POSINFOASSETLIST[TargetAsset.IMEI];

        if (asset) {
            window.PosMarker[TargetAsset.IMEI].setLatLng([asset.posInfo.lat, asset.posInfo.lng]);

            data.posTime.html(asset.posInfo.positionTime.format(window.COM_TIMEFORMAT));
            data.posMileage.html((Protocol.Helper.getMileageValue(asset.Unit, asset.posInfo.mileage) + parseInt(asset.InitMileage) + parseInt(asset._FIELD_FLOAT7)) + '&nbsp;' + Protocol.Helper.getMileageUnit(asset.Unit));
            data.posSpeed.html(Protocol.Helper.getSpeedValue(asset.Unit, asset.posInfo.speed) + ' ' + Protocol.Helper.getSpeedUnit(asset.Unit));
            MapTrack.setView([asset.posInfo.lat, asset.posInfo.lng]);

            var latlng = {};
            latlng.lat = asset.posInfo.lat;
            latlng.lng = asset.posInfo.lng;

            /*if (data.routeButton) {
                data.routeButton.attr('href',API_ROUTE+latlng.lat+','+latlng.lng);
            }*/

            if (data.panoButton) {
                data.panoButton.data('lat',latlng.lat);
                data.panoButton.data('lng',latlng.lng);
            }
            if (data.routeButton) {
                data.routeButton.data('lat',latlng.lat);
                data.routeButton.data('lng',latlng.lng);
            }

            if (data.posLatlng) {
               data.posLatlng.html('GPS: ' + Protocol.Helper.convertDMS(latlng.lat, latlng.lng));
            }

            Protocol.Helper.getAddressByGeocoder(latlng,function(address){
                data.posAddress.html(address);
            });
        }

}

function loadPageStatusMessage(params){
	if (params) {
		var assetList = getAssetList();
		var asset = assetList[params.Imei];
		var assetImg = getAssetImg(asset, {'statusPage':true});
		var direct = params.Direct;
        var deirectionCardinal = Protocol.Helper.getDirectionCardinal(direct);
        var accGreen = false;
        if (params.Acc && params.Acc == 'ON') {
        	accGreen = true;
	    }

	    params.AssetImg = assetImg;
	    params.Direction = deirectionCardinal;
        params.DirectionNumber = direct+'&deg';
	    params.AccGreen = accGreen;
        if (asset && params.Mileage) {
            params.Mileage = Protocol.Helper.getMileage(asset, params.Mileage);
        }
        if (asset && params.LaunchHours) {
            params.EngineHours = Protocol.Helper.getEngineHours(asset, params.LaunchHours);
        }
        console.log(params);
	    mainView.router.load({
		    url:'resources/templates/asset.status.message.html',
		    context:params
		});


	}

}

function loadPageStatus(){
	var asset = POSINFOASSETLIST[TargetAsset.IMEI];

    if (asset) {
    	var assetImg = getAssetImg(asset, {'statusPage':true});
    	var assetFeaturesStatus = Protocol.Helper.getAssetStateInfo(asset);
	    var speed = Protocol.Helper.getSpeedValue(asset.Unit, asset.posInfo.speed) + ' ' + Protocol.Helper.getSpeedUnit(asset.Unit);
        var direct = asset.posInfo.direct;
        var deirectionCardinal = Protocol.Helper.getDirectionCardinal(direct);
	    var time = LANGUAGE.COM_MSG11;
	    if (asset.posInfo.positionTime) {
	        time = asset.posInfo.positionTime.format(window.COM_TIMEFORMAT);
	    }

	    var latlng = {};
	    latlng.lat = asset.posInfo.lat;
	    latlng.lng = asset.posInfo.lng;
	    var assetStats = {
	        voltage: false,
	        acc: false,
	        accGreen: false,
	        acc2: false,
	        mileage: false,
	        battery: false,
	        fuel: false,
            engineHours: false,
	    };


	    if (assetFeaturesStatus.acc) {
	        assetStats.acc = assetFeaturesStatus.acc.value;
	        if (assetFeaturesStatus.acc.value == 'ON') {
	        	assetStats.accGreen = true;
	        }
	    }
	    /*if (assetFeaturesStatus.acc2) {
	        assetStats.acc2 = assetFeaturesStatus.acc.value;
	    }    */
	    if (assetFeaturesStatus.voltage) {
	        assetStats.voltage = assetFeaturesStatus.voltage.value;
	    }
	    if (assetFeaturesStatus.mileage) {
	        assetStats.mileage = assetFeaturesStatus.mileage.value;
            assetStats.engineHours = assetFeaturesStatus.engineHours.value;
	    }
	    if (assetFeaturesStatus.battery) {
	        assetStats.battery = assetFeaturesStatus.battery.value;
	    }
	    if (assetFeaturesStatus.fuel) {
	        assetStats.fuel = assetFeaturesStatus.fuel.value;
	    }
        if (assetFeaturesStatus.temperature) {
            assetStats.temperature = assetFeaturesStatus.temperature.value;
        }
        if (assetFeaturesStatus.engineHours) {
            assetStats.engineHours = assetFeaturesStatus.engineHours.value;
        }


        //console.log(assetStats);
	    mainView.router.load({
	        url:'resources/templates/asset.status.html',
	        context:{
	        	AssetImg: assetImg,
	            Name: asset.Name,
	            Time: time,
	            Direction: deirectionCardinal,//+' ('+direct+'&deg;)',
                DirectionNumber: direct+'&deg;',
	            Speed: speed,
	            Address: LANGUAGE.COM_MSG08,
	            Voltage: assetStats.voltage,
	            Acc: assetStats.acc,
	            AccGreen: assetStats.accGreen,
	            /*Acc2: assetStats.acc2,*/
	            Mileage: assetStats.mileage,
                EngineHours: assetStats.engineHours,
	            Battery: assetStats.battery,
	            Fuel: assetStats.fuel,
                Temperature: assetStats.temperature,
                Coords: 'GPS: ' + Protocol.Helper.convertDMS(latlng.lat, latlng.lng),
	        }
	    });

        if (latlng.lat !== 0 && latlng.lng !== 0) {
            Protocol.Helper.getAddressByGeocoder(latlng,function(address){
                $$('body .display_address').html(address);
            });
        }else{
            $$('body .display_address').html(LANGUAGE.COM_MSG11);
        }

    }else{
    	App.alert(LANGUAGE.PROMPT_MSG007);
    }
}

function loadPageLocation(params){
	var asset = POSINFOASSETLIST[TargetAsset.IMEI];

    var details = {
    	direct : '',
		speed : 0,
    	mileage : '-',
    	templateUrl : 'resources/templates/asset.track.html',
    	latlng : {},
    	name : '',
    	time : '',
    };

    if (params && parseFloat(params.lat) !== 0 && parseFloat(params.lng) !== 0 || params && parseFloat(params.Lat) !== 0 && parseFloat(params.Lng) !== 0 || !params && asset && parseFloat(asset.posInfo.lat) !== 0 && parseFloat(asset.posInfo.lng) !== 0) {
    	if (params) {
    		if (params.Lat && params.Lng) {
    			window.PosMarker[TargetAsset.IMEI] = L.marker([params.Lat, params.Lng], {icon: Protocol.MarkerIcon[0]});
	        	window.PosMarker[TargetAsset.IMEI].setLatLng([params.Lat, params.Lng]);
    		}else{
    			window.PosMarker[TargetAsset.IMEI] = L.marker([params.lat, params.lng], {icon: Protocol.MarkerIcon[0]});
	        	window.PosMarker[TargetAsset.IMEI].setLatLng([params.lat, params.lng]);
    		}

	        if (typeof asset.Unit !== "undefined" && typeof params.speed !== "undefined" || typeof asset.Unit !== "undefined" && typeof params.Speed !== "undefined") {
	        	if (params.Speed) {
	        		details.speed = Protocol.Helper.getSpeedValue(asset.Unit, params.Speed) + ' ' + Protocol.Helper.getSpeedUnit(asset.Unit);
	        	}else{
	        		details.speed = Protocol.Helper.getSpeedValue(asset.Unit, params.speed) + ' ' + Protocol.Helper.getSpeedUnit(asset.Unit);
	        	}
	        }

	        details.templateUrl = 'resources/templates/asset.location.html';
        	details.latlng.lat = params.Lat ? params.Lat : params.lat;
        	details.latlng.lng = params.Lng ? params.Lng : params.lng;
        	details.name = params.AssetName ? params.AssetName : params.name;
        	details.time = params.PositionTime ? params.PositionTime : params.time;
        	details.direct = params.Direction ? params.Direction : params.direct;
        	details.direct = parseInt(details.direct);

		}else{
			window.PosMarker[TargetAsset.IMEI] = L.marker([asset.posInfo.lat, asset.posInfo.lng], {icon: Protocol.MarkerIcon[0]});
	        window.PosMarker[TargetAsset.IMEI].setLatLng([asset.posInfo.lat, asset.posInfo.lng]);
	        details.direct = asset.posInfo.direct;
	        if (typeof asset.Unit !== "undefined" && typeof asset.posInfo.speed !== "undefined") {
	            details.speed = Protocol.Helper.getSpeedValue(asset.Unit, asset.posInfo.speed) + ' ' + Protocol.Helper.getSpeedUnit(asset.Unit);
	        }
	        if (typeof asset.Unit !== "undefined" && typeof asset.posInfo.mileage !== "undefined" && asset.posInfo.mileage != '-') {
	            details.mileage = (Protocol.Helper.getMileageValue(asset.Unit, asset.posInfo.mileage) + parseInt(asset.InitMileage) + parseInt(asset._FIELD_FLOAT7)) + '&nbsp;' + Protocol.Helper.getMileageUnit(asset.Unit);
	        }
	        details.latlng.lat = asset.posInfo.lat;
        	details.latlng.lng = asset.posInfo.lng;
        	details.name = asset.Name;
        	details.time = asset.posInfo.positionTime.format(window.COM_TIMEFORMAT);
		}
	   	var deirectionCardinal = Protocol.Helper.getDirectionCardinal(details.direct);
	   	checkMapExisting();

	   	mainView.router.load({
            url:details.templateUrl,
            context:{
                Name: details.name,
                Time: details.time,
                Direction: deirectionCardinal+' ('+details.direct+'&deg;)',
                Mileage: details.mileage,
                Speed: details.speed,
                Address: LANGUAGE.COM_MSG08,
                Lat: details.latlng.lat,
                Lng: details.latlng.lng,
                Coords: 'GPS: ' + Protocol.Helper.convertDMS(details.latlng.lat, details.latlng.lng),
            }
        });

        Protocol.Helper.getAddressByGeocoder(details.latlng,function(address){
            $$('body .display_address').html(address);
        });

    }else{
        App.alert(LANGUAGE.PROMPT_MSG004);
    }


}

function showMap(params){
	var asset = TargetAsset.IMEI;
	var latlng = [];
	if (params) {
		latlng = [params.lat, params.lng];
	}else{
		latlng = [POSINFOASSETLIST[asset].posInfo.lat, POSINFOASSETLIST[asset].posInfo.lng];
	}


    MapTrack = Protocol.Helper.createMap({ target: 'map', latLng: latlng, zoom: 15 });
    window.PosMarker[asset].addTo(MapTrack);
    if (!StreetViewService) {
        StreetViewService = new google.maps.StreetViewService();
    }

}



function processSVData(data, status) {
    var SVButton = $$(document).find('.pano_button');
    var parrent = SVButton.closest('.pano_button_wrapper');

    if (SVButton) {
        if (status === 'OK') {
            parrent.removeClass('disabled');
        } else {
            parrent.addClass('disabled');
            console.log('Street View data not found for this location.');
        }
    }
}

function showStreetView(params){
    var dynamicPopup = '<div class="popup">'+
                              '<div class="float_button_wrapper back_button_wrapper close-popup"><i class="f7-icons">close</i></div>'+
                              '<div class="pano_map">'+
                                '<div id="pano" class="pano" ></div>'+
                              '</div>'+
                            '</div>';
    App.popup(dynamicPopup);

    var panoramaOptions = {
            position: new google.maps.LatLng(params.lat, params.lng),
            pov: {
                heading: 0,
                pitch: 0
            },
            linksControl: false,
            panControl: false,
            enableCloseButton: false,
            addressControl: false
    };
    var panorama = new google.maps.StreetViewPanorama(document.getElementById('pano'),panoramaOptions);
}

function updateAssetsListStats(){
    var assetFeaturesStatus = '';
    var state = '';
    var value = '';
    $.each( POSINFOASSETLIST, function( key, val ) {
        assetFeaturesStatus = Protocol.Helper.getAssetStateInfo(POSINFOASSETLIST[key]);
        if (assetFeaturesStatus.GSM) {
            state = $$("#signal-state"+key);
            state.removeClass('state-0 state-1 state-2 state-3');
            state.addClass(assetFeaturesStatus.GSM.state);
        }
        if (assetFeaturesStatus.GPS) {
            state = $$("#satellite-state"+key);
            state.removeClass('state-0 state-1 state-2 state-3');
            state.addClass(assetFeaturesStatus.GPS.state);
        }
        if (assetFeaturesStatus.status) {
            state = $$("#status-state"+key);
            state.removeClass('state-0 state-1 state-2 state-3');
            state.addClass(assetFeaturesStatus.status.state);
            value = $$("#status-value"+key);
            value.html(assetFeaturesStatus.status.value);
        }

        if (assetFeaturesStatus.speed) {
            value = $$("#speed-value"+key);
            value.html(assetFeaturesStatus.speed.value);
        }
        if (assetFeaturesStatus.temperature) {
            value = $$("#temperature-value"+key);
            value.html(assetFeaturesStatus.temperature.value);
        }
        if (assetFeaturesStatus.fuel) {
            value = $$("#fuel-value"+key);
            value.html(assetFeaturesStatus.fuel.value);
        }
        if (assetFeaturesStatus.voltage) {
            value = $$("#voltage-value"+key);
            value.html(assetFeaturesStatus.voltage.value);
        }
        if (assetFeaturesStatus.battery) {
            value = $$("#battery-value"+key);
            value.html(assetFeaturesStatus.battery.value);
        }
        /*if (assetFeaturesStatus.driver) {
            value = $$("#driver-value"+key);
            value.html(assetFeaturesStatus.battery.value);
        } */
    });
}


function getNewNotifications(params){


    var userInfo = getUserinfo();
    var MinorToken = !userInfo ? '': userInfo.MinorToken;
    var deviceToken = !localStorage.PUSH_DEVICE_TOKEN? '' : localStorage.PUSH_DEVICE_TOKEN;

    if (MinorToken && deviceToken) {
        var container = $$('body');
        if (container.children('.progressbar, .progressbar-infinite').length) return; //don't run all this if there is a current progressbar loading
        App.showProgressbar(container);

        localStorage.notificationChecked = 0;
        var url = API_URL.URL_GET_NEW_NOTIFICATIONS.format(MinorToken,encodeURIComponent(deviceToken));
        //console.log(url);
        JSON1.request(url, function(result){
                App.hideProgressbar();
                localStorage.notificationChecked = 1;
                if (params && params.ptr === true) {
                    App.pullToRefreshDone();
                }
                if(window.plus) {
                    plus.push.clear();
                }

                console.log(result);
                if (result.MajorCode == '000') {
                    var data = result.Data;
                    if (Array.isArray(data) && data.length > 0) {
                        setNotificationList(result.Data);

                        var page = App.getCurrentView().activePage;
                        if ( page && page.name != "notification" ) {
                            $$('.notification_button').addClass('new_not');
                        }else{
                        	var messageList = setCurrentTimezone(result.Data);
                            showNotification(messageList);
                        }
                    }

                    if (params && params.loadPageNotification === true) {
                    	var user = localStorage.ACCOUNT;
					    var notList = getNotificationList();

					    if (notList && notList[user] && notList[user].length > 0 || Array.isArray(data) && data.length > 0) {
					        mainView.router.load({
					            url:'resources/templates/notification.html',
					        });
					        $$('.notification_button').removeClass('new_not');
					    }else{
					        App.addNotification({
					            hold: 3000,
					            message: LANGUAGE.PROMPT_MSG019
					        });
					    }
                    }
                }else{
                    console.log(result);
                }

            },
            function(){
                App.hideProgressbar();
                localStorage.notificationChecked = 1;
                if (params && params.ptr === true) {
                    App.pullToRefreshDone();
                }
            }
        );
    }

}



function setCurrentTimezone(messageList){
	var newMessageList = [];
	var msg = null;
	if (Array.isArray(messageList)) {
        for (var i = 0; i < messageList.length; i++) {
            msg = null;
            if (messageList[i].payload) {
                msg = isJsonString(messageList[i].payload);
                if (!msg) {
                    msg = messageList[i].payload;
                }
            }else{
                msg = isJsonString(messageList[i]);
                if (!msg) {
                    msg = messageList[i];
                }
            }
            if (msg ) {
                if (msg.PositionTime) {
                    localTime  = moment.utc(msg.PositionTime).toDate();
                    msg.PositionTime = moment(localTime).format(window.COM_TIMEFORMAT);
                }
                if (msg.time) {
                	localTime  = moment.utc(msg.time).toDate();
                    msg.time = moment(localTime).format(window.COM_TIMEFORMAT);
                }
                if (msg.CreateDateTime) {
                	localTime  = moment.utc(msg.CreateDateTime).toDate();
                    msg.CreateDateTime = moment(localTime).format(window.COM_TIMEFORMAT);
                }
                newMessageList.push(msg);
            }
        }
    }
	return newMessageList;
}

function removeNotificationListItem(index){
    var list = getNotificationList();
    var user = localStorage.ACCOUNT;

    list[user].splice(index, 1);
    localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.NOTIFICATIONLIST", JSON.stringify(list));
    var existLi = $$('.notification_list li');
    index = existLi.length - 2;
    existLi.each(function(){
        var currentLi = $$(this);
        if (!currentLi.hasClass('deleting')) {
            currentLi.attr('data-id', index);
            index--;
        }
    });
    virtualNotificationList.clearCache();
    //virtualNotificationList.update();
}
function removeAllNotifications(){
    var list = getNotificationList();
    var user = localStorage.ACCOUNT;
    list[user] = [];
    localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.NOTIFICATIONLIST", JSON.stringify(list));
    virtualNotificationList.deleteAllItems();
}
function setNotificationList(list){
    var pushList = getNotificationList();
    var user = localStorage.ACCOUNT;
    if (pushList) {
        if (!pushList[user]) {
            pushList[user] = [];
        }
    }else{
        pushList = {};
        pushList[user] = [];
    }
    var assetList = getAssetList();
    var msg = null;
    var localTime = null;
    var popped = null;
    var isPoppedJson = null;
    var asset = null;
    if (Array.isArray(list)) {
        for (var i = 0; i < list.length; i++) {
            msg = null;
            localTime = null;
            popped = null;
            isPoppedJson = null;
            asset = null;
            if (list[i].payload) {
                 msg = isJsonString(list[i].payload);
                if (!msg) {
                    msg = list[i].payload;
                }
            }else if(list[i]){
                msg = isJsonString(list[i]);
                if (!msg) {
                    msg = list[i];
                }
            }
            if (msg ) {
                if (msg.PositionTime) {
                    localTime  = moment.utc(msg.PositionTime).toDate();
                    msg.PositionTime = moment(localTime).format(window.COM_TIMEFORMAT);
                }
                if (msg.time) {
                    localTime  = moment.utc(msg.time).toDate();
                    msg.time = moment(localTime).format(window.COM_TIMEFORMAT);
                }
                if (msg.CreateDateTime) {
                    localTime  = moment.utc(msg.CreateDateTime).toDate();
                    msg.CreateDateTime = moment(localTime).format(window.COM_TIMEFORMAT);
                }

                if (msg.alarm && msg.alarm == "geolock" || msg.alarm && msg.alarm == "move") {
                    if (msg.imei) {
                        asset = assetList[msg.imei];
                        if (asset) {
                            getNewAssetInfo({'id':asset.Id});
                        }
                    }
                }

                popped = pushList[user].pop();
                if (popped) {
                    isPoppedJson = isJsonString(popped);
                    if (isPoppedJson) {
                        popped = isPoppedJson;
                    }
                    popped = JSON.stringify(popped);
                    msg = JSON.stringify(msg);
                    if (popped != msg) {
                        popped = JSON.parse(popped);
                        pushList[user].push(popped);
                    }
                }

                pushList[user].push(msg);
            }
        }
    }
    localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.NOTIFICATIONLIST", JSON.stringify(pushList));
}

function getNotificationList(){
    var ret = {};var str = localStorage.getItem("COM.QUIKTRAK.QUIKLOC8.NOTIFICATIONLIST");if(str) {ret = JSON.parse(str);}return ret;
}

function clearNotificationList(){
    var list = getNotificationList();
    var user = localStorage.ACCOUNT;
    if(list) {
        list[user] = [];
    }
    localStorage.setItem("COM.QUIKTRAK.QUIKLOC8.NOTIFICATIONLIST", JSON.stringify(list));
}

function showNotification(list){
    var data = null;
    var isJson ='';
    var newList = [];
    var index = parseInt($('.notification_list li').first().data('id'));
    if (list) {
        for (var i = 0; i < list.length; i++) {
            data = null;
            isJson = '';
            if (list[i].payload) {
                isJson = isJsonString(list[i].payload);
                if (isJson) {
                    data = isJson;
                }else{
                    data = list[i].payload;
                }
            }else if(list[i]){
                isJson = isJsonString(list[i]);
                if (isJson) {
                    data = isJson;
                }else{
                    data = list[i];
                }
            }
            if (data) {
                if (isNaN(index)) {
                    index = 0;
                }else{
                    index++;
                }
                data.listIndex = index;

                if (data.PositionTime) {
                    data.PositionTime = data.PositionTime.replace("T", " ");
                }
                if (data.time) {
                    data.time = data.time.replace("T", " ");
                }
                if (data.CreateDateTime) {
                    data.CreateDateTime = data.CreateDateTime.replace("T", " ");
                }
                //console.log(data);
                if (data.alarm) {
                    data.alarm = toTitleCase(data.alarm);
                }
                //console.log(data);

                newList.unshift(data);
            }
        }
        if (virtualNotificationList && newList.length !== 0) {
            virtualNotificationList.prependItems(newList);
        }
    }
}

function processClickOnPushNotification(msgJ){
	console.log(msgJ);
    if (Array.isArray(msgJ)) {
        var msg = null;
        if (msgJ[0].payload) {
            msg = isJsonString(msgJ[0].payload);
            if (!msg) {
                msg = msgJ[0].payload;
            }
        }else{
            msg = isJsonString(msgJ[0]);
            if (!msg) {
                msg = msgJ[0];
            }
        }

        //console.log(msg);
        if( msg && msg.alarm && msg.alarm.toLowerCase() == 'status' ){
            loadPageStatusMessage(msg);
        }else if (msg && parseFloat(msg.lat) && parseFloat(msg.lat) || msg && parseFloat(msg.Lat) && parseFloat(msg.Lat)) {
        	TargetAsset.IMEI = msg.Imei ? msg.Imei : msg.imei;
            loadPageLocation(msg);
        }

    }
}


function showMsgNotification(arrMsgJ){
    if (Array.isArray(arrMsgJ)) {
        var msg = null;
        if (arrMsgJ[0].payload) {
            msg = isJsonString(arrMsgJ[0].payload);
            if (!msg) {
                msg = arrMsgJ[0].payload;
            }
        }else{
            msg = isJsonString(arrMsgJ[0]);
            if (!msg) {
                msg = arrMsgJ[0];
            }
        }
        if (msg) {
            var message = false;
            if (msg.name && msg.title) {
            	message = msg.title +'</br>'+ msg.name;
            }else if (msg.alarm && msg.AssetName) {
            	message = msg.alarm +'</br>'+msg.AssetName;
            }
            if (message) {
            	App.addNotification({
	                hold: 5000,
	                message: message,
	                button: {
	                    text: LANGUAGE.COM_MSG12,
	                    color: 'dealer',
	                    close: false,
	                },
	                onClick: function () {
	                    App.closeNotification('.notifications');
	                    $$('.notification_button').removeClass('new_not');

	                    processClickOnPushNotification(arrMsgJ);
	                },
	            });
            }

        }
    }
}

/* ASSET EDIT PHOTO */


var cropper = null;
var resImg = null;
function initCropper(){
    var image = document.getElementById('image');
    //alert(image);
    cropper = new Cropper(image, {
        aspectRatio: 1/1,
        dragMode:'move',
        rotatable:true,
        minCropBoxWidth:200,
        minCropBoxHeight:200,
        minCanvasWidth:200,
        minCanvasHeight:200,
        minContainerWidth:200,
        minContainerHeight:200,
        crop: function(data) {
         }
    });

}
function saveImg(){
    resImg =  cropper.getCroppedCanvas({
          width: 200,
          height: 200
    }).toDataURL();

    $$('.asset-top').html('<div class="asset-top-img" style=""><img class="item_asset_img" src="\''+resImg+'\'"></div>');



    if (TargetAsset.IMEI) {
        //$$('.assets_list li[data-imei="'+TargetAsset.IMEI+'"] .item-media img').attr('src',resImg);
        $$('.assets_list li[data-imei="'+TargetAsset.IMEI+'"] .item-media').html('<img class="item_asset_img" src="'+resImg+'" >');
    }

    var assetImg = {
        data: resImg,
        id: 'IMEI_'+TargetAsset.IMEI
    };

    App.showPreloader();
    $.ajax({
        type: 'POST',
        url: API_URL.URL_PHOTO_UPLOAD,
        data: assetImg,
        async: true,
        cache: false,
        crossDomain: true,
        success: function (result) {
            App.hidePreloader();
            //var res = JSON.stringify(result);
            //alert(res);
            result = typeof (result) == 'string' ? eval("(" + result + ")") : result;
            if (result.MajorCode == "000") {
                /*App.alert('Result Data:'+ result.Data);*/
                TargetAsset.Img = result.Data;
            }else{
                App.alert('Something wrong. Photo not saved');
            }
            mainView.router.back();
        },
        error: function(XMLHttpRequest, textStatus, errorThrown){
           App.hidePreloader(); App.alert(LANGUAGE.COM_MSG02);
        }
    });

}


function getImage(source){

    if (!navigator.camera) {
        alert("Camera API not supported", "Error");

    }else{
        var options = { quality: 50,
                        destinationType: Camera.DestinationType.DATA_URL,
                        sourceType: source,      // 0:Photo Library, 1=Camera, 2=Saved Album
                        encodingType: 0     // 0=JPG 1=PNG
                      };

        navigator.camera.getPicture(
            function(imgData) {
              //$('.media-object', this.$el).attr('src', "data:image/jpeg;base64,"+imgData);
                mainView.router.load({
                    url: 'resources/templates/asset.edit.photo.html',
                    context: {
                        imgSrc: "data:image/jpeg;base64,"+imgData
                    }
                });

            },
            function() {
                //alert('Error taking picture', 'Error');
            },
            options);
    }

}
