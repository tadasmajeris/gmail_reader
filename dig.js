var scopes = 'https://www.googleapis.com/auth/gmail.modify';
var _messages = [];
var _subjects = [];

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


function onMessagesLoad(loadedMessages) {
  console.log('onMessagesLoad', loadedMessages.length);
  _messages = loadedMessages.slice(0,1);
  /* _messages = loadedMessages; */

  $.each(_messages, function() {
    var messageRequest = gapi.client.gmail.users.messages.get({
      'userId': 'me',
      'id': this.id,
    });

    messageRequest.execute(onMessageLoad);
  });
}


function onMessageLoad(message) {
  /* console.log(message); */
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
  let productId = urlCoverArt.match(/\d+-\d+/g)[0];
  return productId;
}


async function getAudioUrls(message) {
  console.log('getAudioUrls');
  let id = getProductId(message);
  let audioUrls = [];

  for (var s=1; s<10; s++) {
    let side = String('0'+s).slice(-2);
    for (var t=1; t<50; t++) {
      let track = String('0'+t).slice(-2);
      let url = `https://www.juno.co.uk/MP3/SF${id}-${side}-${track}.mp3`;
      let exists = await audioExists(url, s*501+t*150);
      if (exists) {
        audioUrls.push(url);
      } else {
        if (t===1) return audioUrls;
        break;
      }
    }
  }
  return audioUrls;
};


async function getAudioLinks(message) {
  let urls = await getAudioUrls(message);
  console.log(urls);
  var html = '';
  for (let i=0; i<urls.length; i++) {
    let aTag = '<a href="' + urls[i] + '">' + (i+1) + '</a> ';
    html += aTag;
  }
  return html;
};


async function audioExists(url, delay) {
  var sound = new Audio(url);

  let promise = new Promise(resolve => {
    sound.oncanplay = ()=>{ setTimeout(()=>{resolve(1)}, delay?delay:0) }
    sound.onerror = ()=>{ setTimeout(()=>{resolve(0)}, delay?delay:0) }
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
