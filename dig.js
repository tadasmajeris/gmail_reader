var scopes = 'https://www.googleapis.com/auth/gmail.readonly';

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
  console.log('handleAuthResult', authResult);
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
  gapi.client.load('gmail', 'v1', displayInbox);
}


function displayInbox() {
  console.log('displayInbox');
  var request = gapi.client.gmail.users.messages.list({
    'userId': 'me',
    'labelIds': 'INBOX',
    'maxResults': 10
  });

  request.execute(function(response) {
    $.each(response.messages, function() {
      var messageRequest = gapi.client.gmail.users.messages.get({
        'userId': 'me',
        'id': this.id
      });

      messageRequest.execute(appendMessageRow);
    });
  });
}


function appendMessageRow(message) {
  $('.table-inbox tbody').append(
    '<tr>\
      <td>'+getHeader(message.payload.headers, 'From')+'</td>\
      <td>'+getHeader(message.payload.headers, 'Subject')+'</td>\
      <td>'+getHeader(message.payload.headers, 'Date')+'</td>\
    </tr>'
  );
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
