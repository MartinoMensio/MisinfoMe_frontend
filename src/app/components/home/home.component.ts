import { Component, OnInit, OnDestroy } from '@angular/core';
import { APIService, CountResult, OverallCounts } from '../../api.service';
import { trigger, style, transition, animate, keyframes, query, stagger, state } from '@angular/animations';
import { Router, ActivatedRoute } from '@angular/router';
import { FormControl, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { forceManyBody, forceCollide, forceX, forceY, forceLink, forceSimulation } from 'd3-force';
import * as $ from 'jquery';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css'],
  animations: [
    trigger(
      'enterAnimation', [
        transition(':enter', [
          style({ transform: 'translateX(100%)', opacity: 0 }),
          animate('500ms', style({ transform: 'translateX(0)', opacity: 1 }))
        ]),
        transition(':leave', [
          style({ transform: 'translateX(0)', opacity: 1 }),
          animate('500ms', style({ transform: 'translateX(100%)', opacity: 0 }))
        ])
      ]
    )
  ]
})
export class HomeComponent implements OnInit, OnDestroy {

  state_screen_name: string; // the value that comes from the url parameter
  screen_name = new FormControl('');
  score: number;

  score_pos: number;
  score_neg: number;
  score_unk: number;
  tweet_cnt: number;

  colorScheme = {
    domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA']
  };

  result_you: CountResult;
  pie_data_you = [];
  loading_you: Boolean = false;
  show_you: Boolean = false;
  error_you: Boolean = false;

  pie_data_overall = [];
  result_overall: OverallCounts;
  loading_overall: Boolean = false;
  error_overall: Boolean = false;

  loading_friends: Boolean = false;
  friends_count: number;
  friends_screen_names: {}; // a dict {'screen_name': analysed(Boolean)}
  friends_analysis_show: Boolean = false;
  pie_data_friends: any[];
  result_friends: OverallCounts;
  friends_results: Array<CountResult>;
  analyse_remaining_disabled: Boolean = true;

  friends_graph: { links: any[]; nodes: any[]; trick: any };
  graph_force = forceSimulation<any>()
  .force('charge', forceManyBody().strength(-600)) // repulsion of the nodes
  .force('x', forceX()) // make them go to the center
  .force('y', forceY());
  // .force('collide', forceCollide(30))
  graph_force_link = forceLink<any, any>().distance(100).id(node => node.value); // the desired length of the links

  // best_friend: CountResult;
  // best_friend_pie_data = [];
  worst_friend: CountResult;
  worst_friend_pie_data = [];


  you_vs_average = [];
  you_vs_average_multi = [];


  table_data_bad = [];
  table_data_mixed = [];
  table_data_good = [];
  table_data_rebuttals = [];

  private sub: Subscription;

  constructor(private apiService: APIService, private router: Router, private route: ActivatedRoute) { }

  ngOnInit() {
    this.sub = this.route.params.subscribe(params => {
      this.state_screen_name = params['screen_name'];
      this.screen_name.setValue(params['screen_name']);
      console.log('sub called' + this.screen_name.value);
      if (this.screen_name.value) {
        this.analyse();
      }
    });
    this.update_overall();
  }

  ngOnDestroy() {
    this.sub.unsubscribe();
  }

  getErrorMessage() {
    if (this.screen_name.hasError('required')) {
      return 'Screen name is required';
    } else if (this.screen_name.hasError('pattern')) {
      return 'Invalid screen name. It can only contain letters and numbers';
    } else {
      console.log(this.screen_name.errors);
      return 'Invalid';
    }
  }

  update_overall() {
    this.loading_overall = true;
    this.error_overall = false;
    return this.apiService.getOverallCounts().subscribe((results: OverallCounts) => {
      this.result_overall = results;
      this.pie_data_overall = this.extract_results(results);
    }, (error) => {
      console.log(error);
      this.error_overall = true;
    }).add(() => {
      this.loading_overall = false;
    });
  }

  private default_pie_data() {
    return this.extract_results({
      verified_urls_cnt: 0,
      fake_urls_cnt: 0,
      mixed_urls_cnt: 0,
      unknown_urls_cnt: 0
    });
  }

  private extract_results(json_data: any) {

    return [{
      name: 'Valid',
      value: json_data.verified_urls_cnt
    }, {
      name: 'Misinformation',
      value: json_data.fake_urls_cnt
    }, {
      name: 'Mixed',
      value: json_data.mixed_urls_cnt
    }, {
      name: 'Not checked',
      value: json_data.unknown_urls_cnt
    }];
  }

  prepare_table_data(raw_urls_data: Array<any>) {
    // TODO first aggregate by tweet_id
    return raw_urls_data.reduce((acc, curr) => {
      acc.push({
        tweet_id: curr.found_in_tweet,
        tweet_text: curr.tweet_text,
        url: curr.url,
        reason: curr.reason,
        datasets: curr.sources,
        retweet: curr.retweet,
        label: curr.score.label,
        rebuttals: curr.rebuttals
      });
      return acc;
    }, []);
  }

  onSubmit() {
    if (this.state_screen_name !== this.screen_name.value) {
      return this.router.navigate(['/analyse', this.screen_name.value]);
    } else {
      // reload current page
      return this.ngOnInit();
    }
  }

  analyse() {
    this.show_you = true;
    this.loading_you = true;
    this.error_you = false;
    console.log('clicked!!!');
    this.apiService.getUserCounts([this.screen_name.value]).subscribe((results: CountResult) => {
      this.result_you = results;
      this.pie_data_you = this.extract_results(results);

      this.table_data_bad = this.prepare_table_data(results.fake_urls);
      this.table_data_mixed = this.prepare_table_data(results.mixed_urls);
      this.table_data_good = this.prepare_table_data(results.verified_urls);
      this.table_data_rebuttals = this.prepare_table_data(results.rebuttals);

      this.update_overall().add(something => {

        this.you_vs_average = [
          {
            'name': 'You',
            'value': results.score
          },
          {
            'name': 'Average',
            'value': this.result_overall.score
          }
        ];

        this.you_vs_average_multi = [
          {
            name: 'You',
            series: [
              {
                name: 'Valid',
                value: results.verified_urls_cnt
              }, {
                name: 'Misinformation',
                value: results.fake_urls_cnt
              }, {
                name: 'Not checked',
                value: results.unknown_urls_cnt
              }
            ]
          }, {
            name: 'Overall',
            series: [
              {
                name: 'Valid',
                value: this.result_overall.verified_urls_cnt
              }, {
                name: 'Misinformation',
                value: this.result_overall.fake_urls_cnt
              }, {
                name: 'Not checked',
                value: this.result_overall.unknown_urls_cnt
              }
            ]
          }
        ];
      });
      this.friends_analysis_show = false;
      this.result_friends = this.get_resetted_counts();
      this.friends_results = [];
      this.pie_data_friends = this.default_pie_data();
      this.get_friends_list(this.screen_name.value);
    }, (error) => {
      console.log(error);
      this.error_you = true;
    }).add(() => {
      this.loading_you = false;
    });
  }

  get_friends_list(screen_name) {
    this.loading_friends = true;
    this.apiService.getFriends(screen_name).subscribe((friends_screen_names: Array<string>) => {
      // best and worst
      // this.best_friend = null;
      this.worst_friend = null;

      this.friends_screen_names = {};
      this.friends_count = friends_screen_names.length;
      this.friends_analysis_show = false;
      this.friends_graph = this.generateGraph(this.result_you, []);
      this.apiService.getUserCounts(friends_screen_names, true, true).subscribe((res: any) => {
        Object.keys(res).forEach((el: string) => {
          if (res[el].cache === 'miss') {
            // this is a cache miss, profile not yet evaluated
            this.friends_screen_names[el] = false;
          } else {
            // cache hit
            this.friends_screen_names[el] = true;
            this.update_friends_stat_with_new(res[el]);
          }
        });
        if (this.result_friends.twitter_profiles_cnt < this.friends_count) {
          this.analyse_remaining_disabled = false;
        }
        this.friends_graph.trick(this.friends_graph);
        this.loading_friends = false;
        this.friends_analysis_show = true;
      });
    });
  }

  update_friends_stat_with_new(friend: CountResult) {
    this.result_friends.tweets_cnt += friend.tweets_cnt;
    this.result_friends.shared_urls_cnt += friend.shared_urls_cnt;
    this.result_friends.fake_urls_cnt += friend.fake_urls_cnt;
    this.result_friends.verified_urls_cnt += friend.verified_urls_cnt;
    this.result_friends.mixed_urls_cnt += friend.mixed_urls_cnt;
    this.result_friends.unknown_urls_cnt += friend.unknown_urls_cnt;
    this.result_friends.twitter_profiles_cnt++;
    this.pie_data_friends = this.extract_results(this.result_friends);

    this.friends_analysis_show = true;

    /*
    // check best and worse
    if (!this.best_friend) {
      this.best_friend = friend;
    }
    // first compare the score, then if equal the comparison is on the number of fake urls shared
    if (friend.score > this.best_friend.score) {
      this.best_friend = friend;
    } else if (friend.score === this.best_friend.score) {
      if (friend.fake_urls_cnt < this.best_friend.fake_urls_cnt) {
        this.best_friend = friend;
      } else if (friend.fake_urls_cnt === this.best_friend.fake_urls_cnt) {
        if (friend.verified_urls_cnt > this.best_friend.verified_urls_cnt) {
          this.best_friend = friend;
        }
      }
    }
    */
    if (!this.worst_friend) {
      this.worst_friend = friend;
    }
    if (friend.score < this.worst_friend.score) {
      this.worst_friend = friend;
    } else if (friend.score === this.worst_friend.score) {
      if (friend.fake_urls_cnt > this.worst_friend.fake_urls_cnt) {
        this.worst_friend = friend;
      }
    }
    // this.best_friend_pie_data = this.extract_results(this.best_friend);
    this.worst_friend_pie_data = this.extract_results(this.worst_friend);

    this.friends_results.push(friend);
    // this.updateGraphWithFriend(this.friends_graph, this.result_you, friend);
    this.friends_graph = this.generateGraph(this.result_you, this.friends_results);
  }

  get_resetted_counts(): OverallCounts {
    return {
      screen_name: '',
      profile_image_url: '',
      score: -1,
      tweets_cnt: 0,
      shared_urls_cnt: 0,
      fake_urls_cnt: 0,
      unknown_urls_cnt: 0,
      verified_urls_cnt: 0,
      mixed_urls_cnt: 0,
      fake_urls: [],
      verified_urls: [],
      mixed_urls: [],
      rebuttals: [],
      twitter_profiles_cnt: 0
    };
  }

  analyse_remaining() {
    this.analyse_remaining_disabled = true;
    Object.keys(this.friends_screen_names).forEach((el: string) => {
      if (!this.friends_screen_names[el]) {
        // not already analysed
        // TODO manage wait observable call
        this.apiService.getUserCounts([el], true).subscribe((results: CountResult) => {
          this.update_friends_stat_with_new(results);
          if (this.result_friends.twitter_profiles_cnt % 10 === 0) {
            // update sometimes
            this.update_overall();
          }
          this.friends_graph.trick(this.friends_graph);
        });
      }
    });
    this.update_overall();
  }

  updateGraphWithFriend(graph, you, friend_score) {
    graph.nodes.push({
      value: friend_score.screen_name,
      // x: -100,
      // y: 0,
      options: {
        image: friend_score.profile_image_url,
        size: 20,
        fill: this.getColor(friend_score),
        stroke: this.getColor(friend_score)
      }
    });
    graph.links.push({
      source: you.screen_name,
      target: friend_score.screen_name,
      options: {
        color: this.getColor(friend_score) + '!important'
      }
    });
  }

  generateGraph(you: CountResult, friends_scores: Array<CountResult>) {
    const graph = {
      links: [],
      nodes: [],
      overall_move_x: 20,
      overall_move_y: 20, // the whole graph is translated
      update_trick_ticks: 50,
      update_trick_interval: 100, // milliseconds
      trick: (g) => {
        // This function is needed because the ngx-charts-force-directed-graph is just animating the links and not the edges,
        // unless the mouse moves on the svg.
        // The trick is simply trigger programmatically clicks every 100ms for 5 secs on the center of the graph in order
        // to trigger the update of the position of the edges.
        setTimeout(() => {
          // console.log(`i am a trick ${g} at ${g.update_trick_ticks}`);
          g.update_trick_ticks -= 1;
          if (g.update_trick_ticks > 0) {
            g.trick(g);
            const selector = `[ng-reflect-tooltip-title="${this.screen_name.value}"]`;
            // console.log(selector);
            $(selector).get(0).dispatchEvent(new Event('click'));
          }
        }, 100);
      }
    };
    graph.nodes.push({
      value: you.screen_name,
      options: {
        image: you.profile_image_url,
        size: 20,
        fill: this.getColor(you),
        stroke: this.getColor(you)
      }
    });
    // console.log(friends_scores);
    for (const f of friends_scores) {
      this.updateGraphWithFriend(graph, you, f);
    }
    return graph;
  }

  getColor(counts: CountResult) {
    if (counts.score > 50) {
      return 'rgb(90, 164, 84)';
    } else if (counts.score < 50) {
      return 'rgb(161, 10, 40)';
    } else {
      return 'grey';
    }
  }

  getGraphHeight() {
    // a proportional value to the friends, between the two extremes
    const min_height = 300;
    const max_height = 1000;
    const max_friends = 500;
    return min_height + (this.result_friends.twitter_profiles_cnt) * (max_height - min_height) / max_friends;
  }

  select_node(event: any) {
    console.log('node selected');
    console.log(event);
    const screen_name = event.name;
    console.log(screen_name);
    this.router.navigate(['/analyse', screen_name]);
    return;
  }

}
