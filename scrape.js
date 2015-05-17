var request = require('request');
var cheerio = require('cheerio');

var baseUrl = 'http://tennislink.usta.com';
var url = baseUrl + '/Tournaments/Schedule/SearchResults.aspx?Action=2&SectionDistrict=8096&Zip=75044&Division=D5004&QuickSearch=3&Sanctioned=0&State=TX';
var tournaments = {};
var idRegex = /(\d)+\s*$/;

request(url, function(error, response, html) {
    if (!error) {
        var $ = cheerio.load(html);

        var rows = $('div.CommonTable > table > tr:nth-child(1n + 2)');
        rows.each(function(i, elem) {
            var tournament = {};
            
            var nameValue = $('td > a:nth-child(1)', this).text().trim();
            var nameParts = $('td > a:nth-child(1)', this).text().split('(');
            var m;
            if ((m = idRegex.exec(nameValue)) !== null)
                tournament.id = m[0];
            tournament.name = nameParts[0].trim();
            tournament.divisions = nameParts[1].split(')')[0].trim();
            tournament.deadline = $('td > font:nth-child(1)', this).text().trim();
            tournament.link = baseUrl + $('td:nth-child(5) > a', this).attr('href').trim();
            tournament.location = $('td:nth-child(3) > a:nth-child(4)', this).attr('href').trim().split('=')[1];;
            tournament.date = $('td:nth-child(1)', this).text().trim();
            
            tournaments[tournament.id] = tournament;
        });
        
        console.log(tournaments);
        console.log('count: ' + Object.keys(tournaments).length);
    }
});
