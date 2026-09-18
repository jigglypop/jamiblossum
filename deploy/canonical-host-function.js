function handler(event) {
  var request = event.request;
  var host = request.headers.host && request.headers.host.value.toLowerCase();
  if (host === 'www.jamiblossom.com') {
    var query = '';
    var parts = [];
    for (var key in request.querystring) {
      var item = request.querystring[key];
      if (item.multiValue) {
        for (var i = 0; i < item.multiValue.length; i++) parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(item.multiValue[i].value));
      } else if (item.value !== '') parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(item.value));
      else parts.push(encodeURIComponent(key));
    }
    if (parts.length) query = '?' + parts.join('&');
    return {
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: 'https://jamiblossom.com' + request.uri + query } }
    };
  }
  return request;
}
