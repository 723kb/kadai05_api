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
    const railwayNames = {
        'TokyoMetro.Chiyoda': '東京メトロ千代田線'
        // 他の路線名もここに追加
    };
    return railwayNames[code] || code;
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
    const content = `<div><strong>${stationName}（${railwayName}）</strong><br><input type="text" id="messageInput"><button id="sendMessageButton" onclick="sendMessage('${stationName}', '${railwayName}')">送信</button><div id="chatMessages"></div></div>`;
    infowindow.setContent(content);
    infowindow.setPosition(position);
    infowindow.open(map);

    infowindow.addListener('domready', function() {
        renderChat(stationName, railwayName);
    });
}

function sendMessage(stationName, railwayName) {
    console.log('sendMessage() 関数が呼び出されました。');
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    console.log('Save Data:', { stationName, railwayName, message });

    // メッセージが空でない場合のみ保存および表示の処理を行う
    if (message !== '' && selectedStation !== null) {
        const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
        const timestamp = new Date().toLocaleString();
        const newMessage = { message: message, timestamp: timestamp, railwayName: railwayName };
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

    let html = `<h2>${railwayName}</h2><h2>${stationName}</h2>`;
    messages.forEach((messageObj, index) => {
        const message = messageObj.message;
        const timestamp = messageObj.timestamp;
        html += `
            <div>
                <p>${message} - ${timestamp}</p>
                <button onclick="deleteMessage('${stationName}', '${railwayName}', ${index})">削除</button>
            </div>`;
    });
    html += `<button onclick="deleteAllMessages('${stationName}', '${railwayName}')">全て削除</button>`;
    stationInfo.innerHTML = html;
}




function updateStationList() {
    const stationList = document.getElementById('station-list');
    stationList.innerHTML = '';
    for (const station in chatStations) {
        const listItem = document.createElement('li');
        listItem.textContent = `${chatStations[station]} - ${station}`;
        listItem.onclick = () => {
            const marker = stationMarkers[station];
            if (marker) {
                map.setCenter(marker.getPosition());
                map.setZoom(15); // マーカークリック時にズームイン
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

        // チャットデータが全て削除された場合、chat-station-listから駅を削除
        if (chatData[stationName].length === 0) {
            deleteAllMessages(stationName, railwayName);
        }
    }
}

function deleteAllMessages(stationName, railwayName) {
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    delete chatData[stationName];
    localStorage.setItem('chatData', JSON.stringify(chatData));
    
    delete chatStations[stationName];
    updateStationList();
    renderChat(stationName, railwayName);

    // 一覧から駅を削除
    const stationList = document.getElementById('station-list');
    const stationListItem = stationList.querySelector(`li[data-station="${stationName}"]`);
    if (stationListItem) {
        stationListItem.remove();
    }
}

function loadChatStations() {
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    for (const station in chatData) {
        const messages = chatData[station];
        const railwayName = messages.length > 0 ? messages[0].railwayName : '不明な路線';
        chatStations[station] = railwayName;
    }
    updateStationList();
}


