const ODPT_API_KEY = '[YOUR_ODPT_API_KEY]';

let map;
let infowindow;
let selectedStation = null;

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: { lat: 35.6895, lng: 139.6917 } // 東京の中心
    });
    infowindow = new google.maps.InfoWindow();

    fetchStationInfo();
}

async function fetchStationInfo() {
    const url = `https://api.odpt.org/api/v4/odpt:Station?odpt:operator=odpt.Operator:TokyoMetro&odpt:railway=odpt.Railway:TokyoMetro.Chiyoda&acl:consumerKey=${ODPT_API_KEY}`;
    
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

            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: map,
                title: name
            });

            marker.addListener('click', function () {
                selectedStation = name;
                showChatArea(name, marker.getPosition());
            });
        });
    } catch (error) {
        console.error('Request Failed:', error);
    }
}

function showChatArea(stationName, position) {
    const content = `<div><strong>${stationName}</strong><br><input type="text" id="messageInput"><button id="sendMessageButton">送信</button><div id="chatMessages"></div></div>`;
    infowindow.setContent(content);
    infowindow.setPosition(position);
    infowindow.open(map);

    infowindow.addListener('domready', function() {
        document.getElementById('sendMessageButton').addEventListener('click', function() {
            sendMessage();
        });

        renderChat(stationName); // ピンをクリックしたときに保存した内容を表示する
    });
}


function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message !== '' && selectedStation !== null) {
        const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
        const timestamp = new Date().toLocaleString(); // 現在の日時を取得
        const newMessage = { message: message, timestamp: timestamp };
        chatData[selectedStation] = chatData[selectedStation] || [];
        chatData[selectedStation].push(newMessage);
        localStorage.setItem('chatData', JSON.stringify(chatData));

        renderChat(selectedStation);
        
        messageInput.value = ''; // 入力フィールドをクリア
    }
}


function renderChat(stationName) {
    const stationInfo = document.getElementById('station-info');
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    const messages = chatData[stationName] || [];
    
    let html = `<h2>${stationName}</h2>`;
    messages.forEach(messageObj => {
        const message = messageObj.message;
        const timestamp = messageObj.timestamp;
        html += `<p>${message} - ${timestamp}</p>`;
    });
    stationInfo.innerHTML = html;
}


