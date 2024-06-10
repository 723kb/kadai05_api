const ODPT_API_KEY = '[YOUR_ODPT_API_KEY';

let map;
let infowindow;
let selectedStation = null;

function initMap() {
    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 12,
        center: { lat: 35.696932, lng: 139.765432 } // 新御茶ノ水駅 なんとなく真ん中っぽいから
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
            const railwayCode = station['odpt:railway'].split(':')[1]; // 路線コードを取得
            const railwayName = getRailwayName(railwayCode); // 路線名を取得
            console.log(station);
            const marker = new google.maps.Marker({
                position: { lat, lng },
                map: map,
                title: name
            });

            marker.addListener('click', function () {
                selectedStation = name;
                showChatArea(name, railwayName, marker.getPosition()); // 路線名を追加
            });
        });
    } catch (error) {
        console.error('Request Failed:', error);
    }
}

function getRailwayName(code) {
    // ここで路線名の対応表を使ってコードに対応する路線名を取得する
    // 例えば、TokyoMetro.Chiyoda に対応する日本語名が "東京メトロ千代田線" の場合
    if (code === 'TokyoMetro.Chiyoda') {
        return '東京メトロ千代田線';
    }
    // 他の路線に対する処理も同様に追加
}

function showChatArea(stationName, railwayName, position) {
    const content = `<div><strong>${stationName}</strong>（${railwayName}）<br><input type="text" id="messageInput"><button id="sendMessageButton" onclick="sendMessage('${stationName}', '${railwayName}')">送信</button><div id="chatMessages"></div></div>`;
    infowindow.setContent(content);
    infowindow.setPosition(position);
    infowindow.open(map);

    infowindow.addListener('domready', function() {
        renderChat(stationName, railwayName); // ピンをクリックしたときに保存した内容を表示する
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

        renderChat(stationName, railwayName); // 更新されたメッセージを表示

        messageInput.value = ''; // 入力フィールドをクリア
    }
}


function renderChat(stationName, railwayName) {
    const stationInfo = document.getElementById('station-info');
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    const messages = chatData[stationName] || [];
    
    let html = `<h2>${stationName}（${railwayName}）</h2>`;
    messages.forEach((messageObj, index) => {
        const message = messageObj.message;
        const timestamp = messageObj.timestamp;
        html += `
            <div>
                <p>${message} - ${timestamp}</p>
                <button onclick="deleteMessage('${stationName}', '${railwayName}', ${index})">削除</button>
            </div>`;
    });
    html += `<button onclick="deleteAllMessages('${stationName}', '${railwayName}')">全て削除</button>`; // 駅名と路線名を渡す
    stationInfo.innerHTML = html;
}

function deleteMessage(stationName, railwayName, index) {
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    if (chatData[stationName]) {
        chatData[stationName].splice(index, 1);
        localStorage.setItem('chatData', JSON.stringify(chatData));
        renderChat(stationName, railwayName); // 駅名と路線名を渡す
    }
}

function deleteAllMessages(stationName, railwayName) {
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    delete chatData[stationName];
    localStorage.setItem('chatData', JSON.stringify(chatData));
    renderChat(stationName, railwayName); // 駅名と路線名を渡す
}

