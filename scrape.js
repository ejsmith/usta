var request = require('request');
var cheerio = require('cheerio');
var geocoder = require('geocoder');
var async = require('async');
var elasticsearch = require('elasticsearch');

var baseUrl = 'http://tennislink.usta.com';
var url = baseUrl + '/Tournaments/Schedule/SearchResults.aspx?Action=2&SectionDistrict=8096&Zip=75044&Division=D5004&QuickSearch=3&Sanctioned=0&State=TX';
var idRegex = /(\d)+\s*$/;

var client = new elasticsearch.Client({
    host: 'https://co29438y:6e3ic1vul8epug5u@olive-3946292.us-east-1.bonsai.io/',
    //log: 'trace'
});

async.waterfall([
    function(callback) { // delete existing index
        client.indices.delete({
            index: 'usta',
            ignore: [404]
        }).then(function (body) {
            console.log('index was deleted or never existed');
            callback(null);
        });
    },
    function(callback) { // create index
        client.indices.create({
            index: 'usta',
        }).then(function (body) {
            console.log('index was created');
            callback(null);
        });
    },
    function(callback) { // scrape the tournaments page
        request(url, function(error, response, html) {
            if (error) {
                callback(error);
                return;
            }
            
            var tournaments = [];
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
                tournament.location = $('td:nth-child(3) > a:nth-child(4)', this).attr('href').trim().split('=')[1];
                tournament.date = $('td:nth-child(1)', this).text().trim();
    
                tournaments.push(tournament);
            });
            
            callback(null, tournaments);
        });
    },
    function(tournaments, callback) { // geocode the tournament location
        async.each(tournaments, function(tournament, callback) {
            if (!tournament.location || tournament.location.length == 0) {
                callback();
                return;
            }
            
            geocoder.geocode(tournament.location, function(err, data) {
                if (err)
                    console.log(err);

                if (data && data.results && data.results.length > 0)
                    tournament.geo = data.results[0].geometry.location.lat + ',' + data.results[0].geometry.location.lng;

                callback();
            });
        }, function(err) {
            callback(err, tournaments);
        });
    },
    function(tournaments, callback) { // index the tournament
        async.each(tournaments, function(tournament, callback) {
            client.index({
                index: 'usta',
                type: 'tournaments',
                id: tournament.id,
                body: tournament
            }, function (error, response) {
                callback();
            });
        }, function(err) {
            callback(err, tournaments);
        });
    }
], function (err, tournaments) {
    if (err)
        console.log(err);
    
    client.close();
    console.log(tournaments);
    console.log('count: ' + Object.keys(tournaments).length);
});

// client.search({
//     q: 'blah'
// }).then(function(body) {
//     var hits = body.hits.hits;
//     console.log('hits: ' + hits.length);
// }, function(error) {
//     console.trace('error');
// });


