// ODPT API KEY
const ODPT_API_KEY = '[YOUR_ODPT_API_KEY]';

let map;
let infowindow;
let selectedStation = null;
const chatStations = {};
const stationMarkers = {};

// 位置情報を取得し、近くの駅情報を取得する関数
function initMap() {
    map = new google.maps.Map(document.getElementById('map'), { // mapの初期化
        zoom: 12,
        center: { lat: 35.6895, lng: 139.6917 } // 東京の中心
    });
    infowindow = new google.maps.InfoWindow();  // infowindowの初期化

    // ユーザーの位置情報の取得
    if (navigator.geolocation) {  // 位置情報の取得
        // getCurrentPositionで現在地を取得 成功した場合positionオブジェクトを返す
        navigator.geolocation.getCurrentPosition((position) => {
            const userLocation = {
                lat: position.coords.latitude,  // 緯度
                lng: position.coords.longitude  // 経度
            };
            map.setCenter(userLocation);  // 地図の中心を現在地に設定
            fetchNearbyStations(userLocation);  // fetchNearbyStations関数で現在地近くの駅情報を取得
        }, () => {   // 位置情報の取得に失敗した時、handleLocationErrorでエラーメッセージを表示
            handleLocationError(true, map.getCenter());
        });
    } else {  // ブラウザが位置情報の取得に対応していない場合も、同様
        handleLocationError(false, map.getCenter());
    }

    loadChatStations(); // ロード時にチャットステーションを読み込む
}

// ユーザーの位置情報取得時にエラーが発生した時の関数
// browserHasGeolocation true:ブラウザの位置情報サービスサポートOK+位置情報取得失敗
// false:ブラウザの位置情報サービスサポートNG
function handleLocationError(browserHasGeolocation, pos) {  // pos google.maps.LatLngのオブジェクト
    infowindow.setPosition(pos);  // 情報ウィンドウの位置を設定
    infowindow.setContent(browserHasGeolocation ?  // エラーメッセージの設定
        'Error: 位置情報の取得に失敗しました' :  // trueのエラーメッセージ
        'Error: あなたのブラウザは位置情報サービスのサポートをしていません');  // falseのエラーメッセージ
    infowindow.open(map);  // 情報ウィンドウを地図上に表示
}

// ODPT APIから東京メトロの駅情報を取得し、各駅にマーカーを追加する関数
async function fetchNearbyStations(userLocation) {
    const url = `https://api.odpt.org/api/v4/odpt:Station?odpt:operator=odpt.Operator:TokyoMetro&acl:consumerKey=${ODPT_API_KEY}`;  // エンドポイントを定義し情報取得のためのURLを指定

    try {
        const response = await fetch(url);  // 指定されたURLからデータを取得
        if (!response.ok) {  // レスポンスがOK出ない場合にエラーをスローする
            throw new Error('Failed to fetch station data');
        }
        const data = await response.json();  // レスポンスデータをJSON形式に変換
        // APIから取得したデータをループして各駅の情報を処理
        data.forEach(station => {
            const lat = station['geo:lat'];
            const lng = station['geo:long'];  // 駅の緯度と経度を取得
            const name = station['odpt:stationTitle']['ja'];  // 駅名を日本語で取得
            const railwayCode = station['odpt:railway'].split(':')[1];  // 路線コードを取得し、:operator:TokyoMetroを除く
            const railwayName = getRailwayName(railwayCode);  // 路線コードから路線名を取得
            const distance = getDistance(userLocation, { lat, lng });  // ユーザーの位置と駅の位置の距離を計算

            // マーカーの設定
            const marker = new google.maps.Marker({  // マップ上にマーカーを作成
                position: { lat, lng },  // 駅の位置を設定
                map: map,  // マーカーを追加する地図を指定
                title: name,  // マーカーのタイトル(駅名)を設定
                icon: getMarkerIcon(distance)  // マーカーのアイコンを距離に基づいて設定
            });
            // 特定の駅名をキーとしてstationMarkersにマーカーオブジェクトを関連づける
            stationMarkers[name] = marker;

            // マーカーがクリックされた時の処理
            marker.addListener('click', function () {
                selectedStation = name;  // クリックされた駅を選択
                showChatArea(name, railwayName, marker.getPosition());  // チャットエリアを表示
            });
        });

        updateStationList(); // 更新された駅一覧を表示
    } catch (error) {  // エラーハンドリング
        console.error('エラーが発生しました:', error);
    }
}

// 路線コードから路線名を受け取る関数
function getRailwayName(code) {
    const railwayNames = {  // キーは路線コード、値が路線名
        'TokyoMetro.Chiyoda': '東京メトロ千代田線',
        'TokyoMetro.Ginza': '東京メトロ銀座線',
        'TokyoMetro.Hanzomon': '東京メトロ半蔵門線',
        'TokyoMetro.Hibiya': '東京メトロ日比谷線',
        'TokyoMetro.Marunouchi': '東京メトロ丸ノ内線',
        'TokyoMetro.Namboku': '東京メトロ南北線',
        'TokyoMetro.Tozai': '東京メトロ東西線',
        'TokyoMetro.Yurakucho': '東京メトロ有楽町線',
        'TokyoMetro.Fukutoshin': '東京メトロ副都心線',
        'TokyoMetro.HibiyaBranch': '東京メトロ日比谷線支線',
        'TokyoMetro.MarunouchiBranch': '東京メトロ丸ノ内線支線'
    };
    return railwayNames[code] || code;  // codeに対応する路線名を返す 存在しなければそのままcodeを返す
}

// 2つの位置情報から、距離を求める関数
// 全くわからないのでコピペ
function getDistance(location1, location2) {
    // 地球の半径（km）
    const R = 6371;

    // 緯度と経度の差をラジアンに変換
    const dLat = (location2.lat - location1.lat) * Math.PI / 180;
    const dLng = (location2.lng - location1.lng) * Math.PI / 180;

    // 緯度をラジアンに変換
    const lat1 = location1.lat * Math.PI / 180;
    const lat2 = location2.lat * Math.PI / 180;

    // ハヴァサインの公式
    // a ２点間の角度の半分の正弦の平方和を計算
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    //  c 地球の中心角を計算
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    // 2点間の距離を計算して返す（km単位）
    return R * c;
}

// 距離に応じて異なる色とサイズのマーカーアイコンを立てる関数
function getMarkerIcon(distance) {
    if (distance < 1) {  // 距離が1km未満の場合
        return {
            url: 'http://maps.google.com/mapfiles/ms/icons/red-dot.png',  // 赤
            scaledSize: new google.maps.Size(40, 40)  // サイズ40*40px
        };
    } else if (distance < 5) {  // 距離が1km以上5km未満の場合
        return {
            url: 'http://maps.google.com/mapfiles/ms/icons/yellow-dot.png',  // 黄
            scaledSize: new google.maps.Size(30, 30)  // サイズ30*30px
        };
    } else {  // それ以外の場合
        return {
            url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png',  // 青
            scaledSize: new google.maps.Size(20, 20)  // サイズ20*20px
        };
    }
}

// 各駅のチャットエリアを表示する関数
function showChatArea(stationName, railwayName, position) {
    // HTMLコンテンツの生成
    const content = `<div><strong>${stationName}（${railwayName}）</strong><br><input type="text" id="messageInput"><button id="sendMessageButton" onclick="sendMessage('${stationName}', '${railwayName}')">送信</button><div id="chatMessages"></div></div>`;
    // infowindowの設定
    infowindow.setContent(content);  // HTMLコンテンツを内容に設定
    infowindow.setPosition(position);  // 地図上の指定された位置に配置
    infowindow.open(map);  // 地図上に開く

    // domreadyイベントの追加
    infowindow.addListener('domready', function () {  // infowindowのDOM要素が完全にロードされたら
        renderChat(stationName, railwayName);  // renderChat関数を呼び出し、チャットメッセージを表示
    });
}

// メッセージを送信する関数
function sendMessage(stationName, railwayName) {
    // console.log('sendMessage() 関数が呼び出されました。');
    const messageInput = document.getElementById('messageInput');
    // trimメソッド テキスト両端の余分な空白を取り除く
    const message = messageInput.value.trim();  // 要素のvalue(ユーザーが入力したテキスト)を取得
    // console.log('Save Data:', { stationName, railwayName, message });

    // メッセージが空でなくnullでもない場合のみ以下実行
    if (message !== '' && selectedStation !== null) {
        const chatData = JSON.parse(localStorage.getItem('chatData')) || {};  // ローカルストレージからデータ取得
        const timestamp = new Date().toLocaleString();  // toLocaleStringメソッド 日時をロケールに基づいた文字列に変換
        const newMessage = { message: message, timestamp: timestamp, railwayName: railwayName };
        chatData[stationName] = chatData[stationName] || [];  // チャットデータがあるか確認 なければから配列代入
        chatData[stationName].push(newMessage);
        localStorage.setItem('chatData', JSON.stringify(chatData));

        // 特定の駅のチャットステーションが存在しない場合のみ
        if (!chatStations[stationName]) {
            chatStations[stationName] = railwayName;  // 新しく追加
            updateStationList();  // 更新された駅一覧を表示
        }

        // チャットのレンダリング
        renderChat(stationName, railwayName);

        messageInput.value = '';
    }
}

// 各駅のチャットメッセージを表示する関数
function renderChat(stationName, railwayName) {
    const stationInfo = document.getElementById('station-info');
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};  // キーがchatDataのデータを取得 なければ空オブジェクトを代入
    const messages = chatData[stationName] || []; // 表示したい駅(stationName)のチャットメッセージを取得 なければ空配列を代入

    // HTMLの生成
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

// チャット投稿がある駅のリストを更新し表示する関数
function updateStationList() {
    const stationList = document.getElementById('station-list');
    stationList.innerHTML = '';  // 一旦空文字でクリアする
    // for...inループでchatStationsオブジェクト内の各要素にアクセス
    for (const station in chatStations) {
        const listItem = document.createElement('li');  // liを生成
        listItem.textContent = `${chatStations[station]} - ${station}`;  // 駅名と路線名を含む
        listItem.onclick = () => {  // マーカーがクリックされた時に実行される関数
            const marker = stationMarkers[station];
            if (marker) {
                map.setCenter(marker.getPosition());  // その位置に中心を移動
                map.setZoom(15); // マーカークリック時にズームイン
                showChatArea(station, chatStations[station], marker.getPosition());  // showChatAreaを呼び出し、チャットエリアを表示
            }
        };
        stationList.appendChild(listItem);  // listItemをstationListに追加
    }
}

// 特定の駅のメッセージを削除する関数
function deleteMessage(stationName, railwayName, index) {
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    if (chatData[stationName]) {
        chatData[stationName].splice(index, 1);  // stationNameキーに対応する配列から指定されたindexの要素を1つ削除
        localStorage.setItem('chatData', JSON.stringify(chatData));
        renderChat(stationName, railwayName);

        // チャットデータが全て削除された場合、chat-station-listから駅を削除
        if (chatData[stationName].length === 0) {
            deleteAllMessages(stationName, railwayName);
        }
    }
}

// メッセージを全削除する関数
function deleteAllMessages(stationName, railwayName) {
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    delete chatData[stationName];
    localStorage.setItem('chatData', JSON.stringify(chatData));

    delete chatStations[stationName];
    updateStationList();
    renderChat(stationName, railwayName);

    // 一覧から駅を削除
    const stationList = document.getElementById('station-list');
    // querySelectorメソッド data-station属性がstationName}に一致するliを見つける
    const stationListItem = stationList.querySelector(`li[data-station="${stationName}"]`);
    if (stationListItem) {
        stationListItem.remove();
    }
}

// ローカルストレージからチャットデータを読み込み、チャットステーションの一覧を生成する関数
function loadChatStations() {
    const chatData = JSON.parse(localStorage.getItem('chatData')) || {};
    // chatDataの全てのプロパティ(駅名)に対してループ処理
    for (const station in chatData) {
        const messages = chatData[station];  // 現在の駅に関連するメッセージの取得
        // messages内にメッセージがあれば最初の路線名を取得 なければ不明な路線を使用
        // 三項演算子 ?の左側がtrueなら?の右側が定数に入る(配列内の0番目のプロパティを取得) falseなら:が定数に入る
        const railwayName = messages.length > 0 ? messages[0].railwayName : '不明な路線';
        chatStations[station] = railwayName;  // チャットステーションの更新
    }
    updateStationList();  // 更新された駅一覧を表示
}

// 不明点
// domready イベント発火のトリガーらしい
// for...in
// 三項演算子
// コールバック関数
// アロー関数でどこまでアクセスできるか