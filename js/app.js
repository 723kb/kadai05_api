const ODPT_API_KEY = '[YOUR_ODPT_API_KEY]';

let map;
let infowindow;
let selectedStation = null;
const chatStations = {};
const stationMarkers = {};

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: { lat: 35.6895, lng: 139.6917 } // 東京の中心
    });
    infowindow = new google.maps.InfoWindow();

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((position) => {
            const userLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            map.setCenter(userLocation);
            fetchNearbyStations(userLocation);
        }, () => {
            handleLocationError(true, map.getCenter());
        });
    } else {
        handleLocationError(false, map.getCenter());
    }

    loadChatStations(); // ロード時にチャットステーションを読み込む
}

function handleLocationError(browserHasGeolocation, pos) {
    infowindow.setPosition(pos);
    infowindow.setContent(browserHasGeolocation ?
                          'Error: The Geolocation service failed.' :
                          'Error: Your browser doesn\'t support geolocation.');
    infowindow.open(map);
}

async function fetchNearbyStations(userLocation) {
    const url = `https://api.odpt.org/api/v4/odpt:Station?odpt:operator=odpt.Operator:TokyoMetro&acl:consumerKey=${ODPT_API_KEY}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch station data');
        }
        const data = await response.json();
        data.forEach(station => {
            const lat = station['geo:lat'];
            const lng = station['geo:long'];
            const name = station['odpt:stationTitle']['ja'];
            const railwayCode = station['odpt:railway'].split(':')[1];
            const railwayName = getRailwayName(railwayCode);
            console.log(station);
            const distance = getDistance(userLocation, { lat, lng });

            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: map,
                title: name,
                icon: getMarkerIcon(distance)
            });

            stationMarkers[name] = marker;

            marker.addListener('click', function () {
                selectedStation = name;
                showChatArea(name, railwayName, marker.getPosition());
            });
        });

        updateStationList(); // 更新された駅一覧を表示
    } catch (error) {
        console.error('Request Failed:', error);
    }
}

function getRailwayName(code) {
    switch (code) {
        case 'TokyoMetro.Chiyoda':
            return '東京メトロ千代田線';
        case 'TokyoMetro.Yurakucho':
            return '東京メトロ有楽町線';
        case 'TokyoMetro.Fukutoshin':
            return '東京メトロ副都心線';
        case 'Toei.Asakusa':
            return '都営地下鉄浅草線';
        // 他の路線に対する処理を追加
        default:
            return '不明な路線';
    }
}


function getDistance(location1, location2) {
    const R = 6371;
    const dLat = (location2.lat - location1.lat) * Math.PI / 180;
    const dLng = (location2.lng - location1.lng) * Math.PI / 180;
    const a = 
        0.5 - Math.cos(dLat) / 2 + 
        Math.cos(location1.lat * Math.PI / 180) * Math.cos(location2.lat * Math.PI / 180) * 
        (1 - Math.cos(dLng)) / 2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

function getMarkerIcon(distance) {
    if (distance < 1) {
        return {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',
            scaledSize: new google.maps.Size(40, 40)
        };
    } else if (distance < 5) {
        return {
            url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
            scaledSize: new google.maps.Size(30, 30)
        };
    } else {
        return {
            url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',
            scaledSize: new google.maps.Size(20, 20)
        };
    }
}

function showChatArea(stationName, railwayName, position) {
    const content = `<div class="st-area">
    <div class="text-xl font-bold p-2">${railwayName}</div>
    <div class="text-xl font-bold p-2">${stationName}</div>
</div>
<div class="input-chat">
<input type="text" id="messageInput" class="border border-slate-500 border-solid rounded-md p-2">
<button id="sendMessageButton" class="p-2 border border-solid rounded-md hover:bg-green-500" onclick="sendMessage('${stationName}', '${railwayName}')">送信</button></div>`;
    infowindow.setContent(content);
    infowindow.setPosition(position);
    infowindow.open(map);

    infowindow.addListener('domready', function() {
        renderChat(stationName, railwayName);
    });
}

function sendMessage(stationName, railwayName) {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message !== '' && selectedStation !== null) {
        const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
        const timestamp = new Date().toLocaleString();
        const newMessage = { message: message, timestamp: timestamp };
        chatData[stationName] = chatData[stationName] || [];
        chatData[stationName].push(newMessage);
        localStorage.setItem('chatData', JSON.stringify(chatData));

        if (!chatStations[stationName]) {
            chatStations[stationName] = railwayName;
            updateStationList();
        }

        renderChat(stationName, railwayName);

        messageInput.value = '';
    }
}

function renderChat(stationName, railwayName) {
    const stationInfo = document.getElementById('station-info');
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    const messages = chatData[stationName] || [];
    
    let html = `<h2 class="text-2xl font-bold text-center p-2">${railwayName}</h2><h2 class="text-2xl font-bold text-center p-2">${stationName}</h2>`;
    messages.forEach((messageObj, index) => {
        const message = messageObj.message;
        const timestamp = messageObj.timestamp;
        html += `
            <div class="flex flex-row mx-auto">
                <p class="p-2">${message} - ${timestamp}</p>
                <button onclick="deleteMessage('${stationName}', '${railwayName}', ${index})" class="p-2 border border-solid rounded-md hover:bg-red-500">削除</button>
            </div>`;
    });
    html += `<button onclick="deleteAllMessages('${stationName}', '${railwayName}')" class="p-2 m-4 border border-solid rounded-md hover:bg-red-500">全て削除</button>`;
    stationInfo.innerHTML = html;
}

function updateStationList() {
    const stationList = document.getElementById('station-list');
    stationList.innerHTML = '';
    for (const station in chatStations) {
        const listItem = document.createElement('li');
        listItem.classList.add('p-2', 'text-xl'); // クラスを追加する
        listItem.textContent = `${chatStations[station]} - ${station}`;
        listItem.onclick = () => {
            const marker = stationMarkers[station];
            if (marker) {
                map.setCenter(marker.getPosition());
                showChatArea(station, chatStations[station], marker.getPosition());
            }
        };
        stationList.appendChild(listItem);
    }
}


function deleteMessage(stationName, railwayName, index) {
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    if (chatData[stationName]) {
        chatData[stationName].splice(index, 1);
        localStorage.setItem('chatData', JSON.stringify(chatData));
        renderChat(stationName, railwayName);
    }
}

function deleteAllMessages(stationName, railwayName) {
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    delete chatData[stationName];
    localStorage.setItem('chatData', JSON.stringify(chatData));
    renderChat(stationName, railwayName);
    
    delete chatStations[stationName];
    updateStationList();
}

function loadChatStations() {
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    for (const station in chatData) {
        const messages = chatData[station].messages || [];
        const railwayName = chatData[station].railwayName || '不明な路線';
        chatStations[station] = railwayName;
    }
    updateStationList();
}





