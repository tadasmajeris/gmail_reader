var scopes = 'https://www.googleapis.com/auth/gmail.modify';
var _messages = [];
var _subjects = [];
var _loading = false;
var _ready = true; // ready for next email to start checking urls
var _interval;
const MAX_EMAILS = 5;

function handleClientLoad() {
  console.log('handleClientLoad');
  gapi.client.setApiKey(apiKey);
  window.setTimeout(checkAuth, 1);
}

function checkAuth() {
  console.log('checkAuth');
  gapi.auth.authorize({
    client_id: clientId,
    scope: scopes,
    immediate: true
  }, handleAuthResult);
}

function handleAuthClick() {
  console.log('handleAuthClick');
  gapi.auth.authorize({
    client_id: clientId,
    scope: scopes,
    immediate: false
  }, handleAuthResult);
  return false;
}

function handleDownloadClick() {
  console.log('handleDownloadClick');
  var delay = 0;

  for (let m=0; m<_messages.length; m++) {
    for (let t=0; t<_messages[m].audioUrls.length; t++) {

      setTimeout(()=>{
        window.open(_messages[m].audioUrls[t]);
        let isLast = (m == _messages.length-1) && (t == _messages[m].audioUrls.length-1);
        if (isLast) afterLastDownload();
      }, delay);

      delay += 2666;
    }
  }
}


function afterLastDownload() {
  console.log('afterLastDownload');
  let delay = 0;
  _messages.forEach((m,i)=>{
    setTimeout(()=>{trashMessage(m.id)}, delay);
    delay += 500;
  });
};


function handleAuthResult(authResult) {
  console.log('handleAuthResult');
  if(authResult && !authResult.error) {
    loadGmailApi();
    $('#authorize-button').remove();
    $('.table-inbox').removeClass("hidden");
  } else {
    $('#authorize-button').removeClass("hidden");
    $('#authorize-button').on('click', function(){
      handleAuthClick();
    });
  }
}

function loadGmailApi() {
  console.log('loadGmailApi');
  gapi.client.load('gmail', 'v1', ()=>{
    loadMessages('me', 'from:subscriptions', onMessagesLoad);
  });
}


async function onMessagesLoad(loadedMessages) {
  console.log('onMessagesLoad', loadedMessages.length);
  _messages = loadedMessages.slice(0, MAX_EMAILS);
  /* _messages = loadedMessages; */

  var i = -1;
  _interval = setInterval(()=>{

    if (_ready && !_loading) {
      if (i+1 >= _messages.length) return enableDownload();

      i++;
      _loading = 1;
      _ready = 0;
      loadOneMessage(_messages[i]);
    }
  }, 500);
}


function enableDownload() {
  clearInterval(_interval);
  $('#download-button').removeClass("hidden");
  $('#download-button').on('click', function(){
    handleDownloadClick();
  });
};


function loadOneMessage(message) {
  var messageRequest = gapi.client.gmail.users.messages.get({
    'userId': 'me',
    'id': message.id,
  });

  messageRequest.execute(onMessageLoad);
};


function onMessageLoad(message) {
  /* console.log(message); */
  if (!message.payload) {
    console.error('onMessageLoad', message);
    return;
  }
  let headers = message.payload.headers;
  let subject = headers.find(h => h.name == 'Subject').value;

  if (!_subjects.includes(subject)) {
    _subjects.push(subject);
    appendMessageRow(message, subject);
  } else {
    trashDuplicate(message, subject);
  }
}


function trashDuplicate(message, subject) {
  var messageRequest = gapi.client.gmail.users.messages.trash({
    'userId': 'me',
    'id': message.id
  });

  messageRequest.execute(r=>{
    if (!('error' in r)) {
      $.each(_messages, function(i, el){
        if (this.id == message.id) _messages.splice(i, 1);
      });
      console.log('deleted: ', subject);
    }
  });
}


function trashMessage(id) {
  var messageRequest = gapi.client.gmail.users.messages.trash({userId: 'me', id });

  messageRequest.execute(r=>{
    if (!('error' in r)) {
      console.log('deleted: ', id);
    } else {
      console.error(r);
    }
  });
}


function loadMessages(userId, query, callback) {
  var getPageOfMessages = function(request, result) {
    request.execute(function(resp) {
      result = result.concat(resp.messages);
      var nextPageToken = resp.nextPageToken;
      if (nextPageToken) {
        request = gapi.client.gmail.users.messages.list({
          'userId': userId,
          'pageToken': nextPageToken,
          'q': query
        });
        getPageOfMessages(request, result);
      } else {
        callback(result);
      }
    });
  };
  var initialRequest = gapi.client.gmail.users.messages.list({
    'userId': userId,
    'q': query
  });
  getPageOfMessages(initialRequest, []);
}


async function appendMessageRow(message, subject) {
  $('#loadCount').text($('tr').length-1 + '/' + MAX_EMAILS);
  $('.table-inbox tbody').append(
    '<tr>\
      <td>' + await getAudioLinks(message) + '</td>\
      <td>\
        <a href="#message-modal-' + message.id +
          '" data-toggle="modal" id="message-link-' + message.id+'">' + subject +
        '</a>\
      </td>\
      <td>'+getHeader(message.payload.headers, 'Date')+'</td>\
    </tr>'
  );

  $('body').append(
    '<div class="modal fade" id="message-modal-' + message.id +
        '" tabindex="-1" role="dialog" aria-labelledby="myModalLabel">\
      <div class="modal-dialog modal-lg">\
        <div class="modal-content">\
          <div class="modal-header">\
            <h4 class="modal-title" id="myModalLabel">' +
              getHeader(message.payload.headers, 'Subject') +
            '</h4>\
            <button type="button"\
                    class="close"\
                    data-dismiss="modal"\
                    aria-label="Close">\
              <span aria-hidden="true">&times;</span></button>\
          </div>\
          <div class="modal-body">\
            <iframe id="message-iframe-'+message.id+'" srcdoc="<p>Loading...</p>">\
            </iframe>\
          </div>\
        </div>\
      </div>\
    </div>'
  );

  $('#message-link-'+message.id).on('click', function(){
    var ifrm = $('#message-iframe-'+message.id)[0].contentWindow.document;
    $('body', ifrm).html(getBody(message.payload));
  });
}


function getHeader(headers, index) {
  var header = '';
  $.each(headers, function(){
    if(this.name === index){
      header = this.value;
    }
  });
  return header;
}


function getBody(message) {
  var encodedBody = '';
  if(typeof message.parts === 'undefined') {
    encodedBody = message.body.data;
  } else {
    encodedBody = getHTMLPart(message.parts);
  }
  encodedBody = encodedBody.replace(/-/g, '+').replace(/_/g, '/').replace(/\s/g, '');
  return decodeURIComponent(escape(window.atob(encodedBody)));
}


function getProductId(message) {
  let body = getBody(message.payload);
  let urls = getUrlsFromHtml(body);
  let urlCoverArt = urls.find(url=>url.includes('alert_cover_art'));
  let productId = urlCoverArt.match(/\d+-\d+\//g)[0].slice(0, -1);
  return productId;
}


function getAudioCount(message) {
  let body = getBody(message.payload);
  let audioCount = $(body).find('img[alt="Listen"]').length;
  return audioCount;
}


async function getAudioUrls(message, audioCount) {
  console.log('getAudioUrls');
  let id = getProductId(message);
  let audioUrls = [];
  let delay = 0;

  for (var s=1; s<10; s++) {
    let side = String('0'+s).slice(-2);
    for (var t=1; t<50; t++) {
      let track = String('0'+t).slice(-2);
      let url = `https://www.juno.co.uk/MP3/SF${id}-${side}-${track}.mp3`;
      let exists = await audioExists(url, delay);
      delay += 888;
      if (exists) {
        audioUrls.push(url);
        if (audioUrls.length == audioCount) return audioUrls;
      } else {
        if (t===1) return audioUrls;
        break;
      }
    }
  }
  return audioUrls;
};


async function getAudioLinks(message) {
  let messageToUpdate = _messages.find(m => m.id==message.id);
  messageToUpdate.audioCount = getAudioCount(message);

  let urls = await getAudioUrls(message, messageToUpdate.audioCount);
  messageToUpdate.audioUrls = urls;

  _ready = 1; _loading = 0;
  var html = '';
  for (let i=0; i<urls.length; i++) {
    let aTag = '<a href="' + urls[i] + '" download target="_blank" data-id="' + message.id + '">' + (i+1) + '</a> ';
    html += aTag;
  }
  return html;
};


async function audioExists(url, delay) {
  var sound = new Audio(url);
  delay = delay ? delay : 0;

  let promise = new Promise(resolve => {
    sound.oncanplay = ()=>{ setTimeout(()=>{resolve(1)}, delay) }
    sound.onerror = (e)=>{
      if (e.target.error.message.slice(0,3) == '404') {
        setTimeout(()=>{resolve(0)}, delay);
      } else {
        setTimeout(()=>{resolve(1)}, delay);
      }
    }
  });

  let result = await promise;
  console.log(result, url);
  return result;
};


function getUrlsFromHtml(html) {
  var doc = document.createElement("html");
  doc.innerHTML = html;
  var links = doc.getElementsByTagName("a")
  var urls = [];

  for (var i=0; i<links.length; i++) {
    urls.push(links[i].getAttribute("href"));
  }

  return urls;
}


function getHTMLPart(arr) {
  for(var x = 0; x <= arr.length; x++) {
    if (typeof arr[x].parts === 'undefined') {
      if(arr[x].mimeType === 'text/html') {
        return arr[x].body.data;
      }
    } else {
      return getHTMLPart(arr[x].parts);
    }
  }
  return '';
}
