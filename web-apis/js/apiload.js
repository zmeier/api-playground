/**
 * State variables
 */
var openInfoWindow = null; // reference to the info window so we can close it upon clicking another
var mapupdater = null; // reference to timeout that is used to make sure we don't load more data every incremental move
var city = "";
var defaultPos = { lat: 43.0747, lng: -89.3843 };
var pos = null;

/**
 * Find the user's location and call into a function if provided
 * 
 * @param {Function} callback - Function to call with position paramater passed in with lat and lng
 */
function findLocation(callback) {
    document.getElementById('map-error-banner').innerHTML = "";

    // Find the users current location and load up foursquare data
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(position) {
            pos = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };

            if (callback) {
                callback(pos);
            }
        }, function() {
            handleLocationError("The Geolocation service failed. Make sure to allow location access.");
        });
    } else {
        // Browser doesn't support Geolocation
        handleLocationError("Error: Your browser doesn't support geolocation.");
    }
}

/**
 * Perform the initial load of the data upon creating the page
 */
function initialLoad() {
    // Update the news data for our site
    updateNews();

    // Update the weather data for our site
    if (!pos) {
        findLocation(updateWeatherInfo);
    } else {
        updateWeatherInfo(pos);
    }
}

/**
 * Initialize the Google Maps visualization, as well as,
 * adding in exploration information from Foursquare
 */
function initMap() {
    document.getElementById('map-error-banner').innerHTML = "";

    // Find the users current location and load up foursquare data
    if (!pos) {
        findLocation(function(pos) {
            // Create a map and add markers based on exploration data
            var map = createMap(pos, { zoom: 14 });
            addAreaPlaces(map);
        });
    } else {
        // Create a map and add markers based on exploration data
        var map = createMap(pos, { zoom: 14 });
        addAreaPlaces(map);
    }
}

/**
 * If we are unable to get a user's location data we will use 
 * the default location and show an error message under the map.
 * 
 * @param {String} errmsg - Error message to display as banner below map
 */
function handleLocationError(errmsg) {
    // Update the weather data for our site
    updateWeatherInfo(defaultPos);

    var errorBanner = document.getElementById("map-error-banner");
    errorBanner.innerHTML = "<p>" + errmsg + "</p>";
    var map = createMap();
    addAreaPlaces(map);
}

/**
 * Create the Google Map based on position data and options passed in
 * 
 * @param {Object} pos - lat: specify latitude position, lng: specify longitude position
 * @param {Object} options - zoom: specify the zoom level
 * @returns map object of type google.maps.Map
 */
function createMap(pos, options) {
    var zoomLevel;

    if (!pos) {
        pos = defaultPos;
    }

    if (!options) {
        options = {};
    }
    options.zoom = options.zoom ? options.zoom : 16;

    var map = new google.maps.Map(document.getElementById('map'), {
        center: pos,
        zoom: options.zoom,
        mapTypeControl: false,
    });

    map.addListener('center_changed', function() {
        clearTimeout(mapupdater);
        mapupdater = setTimeout(function() {
            addAreaPlaces(map);
        }, 500);
    });

    map.addListener('click', function() {
        if (openInfoWindow) {
            openInfoWindow.close();
            openInfoWindow = null;
        }
    });

    return map;
}

/**
 * Make an async call to get foursquare infromation about venues
 * around a user's current location and add these to the map. 
 * 
 * @param {google.maps.Map} map - Map to add location markers to
 */
function addAreaPlaces(map) {
    if (FOURSQUARE_CLIENT_ID === "" || FOURSQUARE_CLIENT_SECRET === "") {
        return;
    }

    if (!map) {
        return;
    }

    var pos = map.getCenter();
    if (!pos) {
        return;
    }

    var exploreURL = "https://api.foursquare.com/v2/venues/explore" +
        "?client_id=" + FOURSQUARE_CLIENT_ID +
        "&client_secret=" + FOURSQUARE_CLIENT_SECRET +
        "&v=20161001&ll=" + pos.lat() + "," + pos.lng();

    $.getJSON(exploreURL, function(data) {
        parseExploreData(map, data);
    }).error(function() {});
}

/**
 * Parse the foursquare callback data for venue information and
 * create markers from this data.
 * 
 * @param {google.maps.Map} map - Map to add location markers to
 * @param {Object} data - JSON object with venue information to add to map 
 */
function parseExploreData(map, data) {
    var places, i;
    if (!data.response) {
        return;
    }
    if (!data.response.groups[0]) {
        return;
    }
    places = data.response.groups[0].items;

    var infoWindow = new google.maps.InfoWindow();

    for (i = 0; i < places.length; i++) {
        addMarker(map, places[i].venue, places[i].tips);
    }
}

/**
 * Add a single marker with an info window to the map
 * 
 * @param {google.maps.Map} map - Map to add marker to
 * @param {Object} place - Venue object from the foursquare API
 * @param {Object} tips - Tips object from the foursquare API
 */
function addMarker(map, place, tips) {
    var name = place.name;
    var pos = { lat: place.location.lat, lng: place.location.lng };

    var marker = new google.maps.Marker({
        position: pos,
        map: map,
        title: name,
    });
    attachInfoWindow(marker, { name: name, tips: tips });
}

/**
 * Add an info window to a marker to display more information
 * about the location and reviews.
 * 
 * @param {google.maps.Marker} marker - Marker to add the info window to
 * @param {Object} data - name: title to display in window, tips: array of tip objects from foursquare API
 */
function attachInfoWindow(marker, data) {
    var info = "<div class='info-title'>" + data.name + "</div>";

    if (data.tips) {
        for (var i = 0; i < 4 && i < data.tips.length; i++) {
            var tip = data.tips[i];
            if (tip) {
                info += "<p>" + tip.text;
                if (tip.user) {
                    info += "<br/>- " + tip.user.firstName;
                }
                info += "</p>";
            }
        }
    }

    var infowindow = new google.maps.InfoWindow({
        content: info,
        maxWidth: 200,
    });

    marker.addListener('click', function() {
        if (openInfoWindow) {
            openInfoWindow.close();
            openInfoWindow = null;
        }
        infowindow.open(marker.get('map'), marker);
        openInfoWindow = infowindow;
    });
}

/**
 * Update the weather information being displayed in the widget
 * 
 * @param {Object} pos - lat: specify latitude position, lng: specify longitude position
 */
function updateWeatherInfo(pos) {
    if (OPENWEATHERMAP_API_KEY === "") {
        return;
    }

    var weatherURL = "http://api.openweathermap.org/data/2.5/weather?" +
        "lat=" + pos.lat +
        "&lon=" + pos.lng +
        "&units=imperial" +
        "&appid=" + OPENWEATHERMAP_API_KEY;

    $.getJSON(weatherURL, function(data) {
        parseWeatherData(data);
    }).error(function() {});
}

/**
 * Parse the weather data retrieved from OpenWeatherMap
 * 
 * @param {Object} data - JSON object with weather data 
 */
function parseWeatherData(data) {
    if (!data || !data.main) {
        return;
    }
    document.getElementById("currenttemp").innerHTML = parseInt(tempConverter(data.main.temp, "F", "F")) + "°F";
    if (data.weather[0]) {
        document.getElementById("currenttempimg").innerHTML = "<img src='http://openweathermap.org/img/w/" + data.weather[0].icon + ".png' alt='" + data.weather[0].main + "' />";
    } else {
        document.getElementById("currenttempimg").innerHTML = "";
    }

    var high = parseInt(tempConverter(data.main.temp_max, "F", "F"));
    var low = parseInt(tempConverter(data.main.temp_min, "F", "F"));
    if (high === low) {
        document.getElementById("temprange").innerHTML = "-- / " + low + "°F";
    } else {
        document.getElementById("temprange").innerHTML = high + "°F" + " / " + low + "°F";
    }

    document.getElementById("humidity").innerHTML = data.main.humidity + "%";
    document.getElementById("wind").innerHTML = data.wind.speed + "mph";
    $("#weathertable").removeClass("nodisp");
}


/**
 * Convert the temperature from Kelvin, Celsius, or Farenheight
 * 
 * @param {Number} temp - Temperature to convert
 * @param {String} fromStr - K, C, or F based on original temp source
 * @param {String} toStr - K, C, or F based on translated to
 * @returns Converted temperature as a Number
 */
function tempConverter(temp, fromStr, toStr) {
    var converter = String(fromStr) + String(toStr);
    switch (converter) {
        case "KF":
            return (temp * (9 / 5)) - 459.67;
        case "KC":
            return temp - 273.15;
        case "CK":
            return temp + 273.15;
        case "CF":
            return (temp * (9 / 5)) + 32;
        case "FK":
            return (temp + 459.67) * (5 / 9);
        case "FC":
            return (temp - 32) * (5 / 9);
        default:
            return temp;
    }
}

/**
 * Update the news feed being displayed for the user
 */
function updateNews() {
    if (BINGNEWSSEARCH_API_KEY === "") {
        return;
    }

    $(function() {
        var params = {
            // Request parameters
            "q": "local news",
            "count": "10",
            "offset": "0",
            "mkt": "en-us",
            "safeSearch": "Moderate",
        };

        $.ajax({
            url: "https://api.cognitive.microsoft.com/bing/v5.0/news/search?" + $.param(params),
            beforeSend: function(xhrObj) {
                // Request headers
                xhrObj.setRequestHeader("Ocp-Apim-Subscription-Key", BINGNEWSSEARCH_API_KEY);
            },
            type: "GET",
        }).done(function(data) {
            parseNewsData(data);
        }).fail(function() {
            alert("error");
        });
    });
}

/**
 * Parse the returned news object from the Bing News API
 * 
 * @param {Object} data - JSON string with all of the news information
 */
function parseNewsData(data) {
    newsItems = data.value;
    var newslist = document.getElementById("newslist");
    var articlelist = "";

    for (var i = 0; i < newsItems.length; i++) {
        var newsItem = newsItems[i];
        articlelist += "<li>" + formatNewsArticle(newsItem) + "</li>";
    }
    newslist.innerHTML = articlelist;
}

/**
 * Format a news article into a table layout to be added to the article list
 * 
 * @param {Object} newsItem - JSON string with the news article information from the Bing API
 * @returns HTML string with the article information formatted
 */
function formatNewsArticle(newsItem) {
    var image;
    if (newsItem.image && newsItem.image) {
        image = newsItem.image.thumbnail;
    }
    // News header
    var content = "<div class='newsheader'><a href='" + newsItem.url + "'><b>" + newsItem.name + "</b></a></div>";
    // News body with the description
    content += "<div class='newsdescription'>" + newsItem.description + "</div>";

    // Layout table with image on left (if applicable), header with hyperlink, and body with the description
    var layout = "<table class='newstable'><tr>";
    if (image) {
        layout += "<td><img src='" + image.contentUrl + "' /></td>";
        layout += "<td>" + content + "</td>";
    } else {
        layout += "<td colspan=2>" + content + "</td>";
    }
    layout += "</tr></table>";

    return layout;
}

function show() {
    getAPIKeys();

    // Initially load the page
    initialLoad();

    // Hide setup and show the main show
    $("#setup").addClass("nodisp");
    $("#mapheader").removeClass("nodisp");
    $("#main").removeClass("nodisp");
}

function getAPIKeys() {
    // Foursquare API keys
    FOURSQUARE_CLIENT_ID = $("#foursquareAPIkey").val();
    FOURSQUARE_CLIENT_SECRET = $("#foursquareAPIsecret").val();

    // OpenWeatherMap API key
    OPENWEATHERMAP_API_KEY = $("#openweatherAPIkey").val();

    // News Search API key
    BINGNEWSSEARCH_API_KEY = $("#bingsearchAPIkey").val();
}