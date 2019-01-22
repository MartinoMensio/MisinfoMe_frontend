import { Component, OnInit } from '@angular/core';
import { APIService } from '../../api.service';
import { GraphComponent } from "../graph/graph.component";

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {

  data_for_graph = {};

  screen_name: string;
  score: number;

  score_pos: number;
  score_neg: number;
  score_unk: number;
  tweet_cnt: number;

  colorScheme = {
    domain: ['#5AA454', '#A10A28', '#C7B42C', '#AAAAAA']
  };

  pie_data_you = []
  pie_data_overall = []
  loading_you: boolean = false
  show_you: boolean = false

  result_you = {}
  result_overall = {}
  loading_overall: boolean = false

  constructor(private apiService: APIService) { }

  ngOnInit() {
    this.update_overall()
  }

  update_overall() {
    this.loading_overall = true
    this.apiService.getEvaluation(`count_urls/overall`).subscribe((results) => {
      this.loading_overall = false
      this.result_overall = results
      console.log(this.result_overall)
      this.pie_data_overall = this.extract_results(results)
    })
  }

  private extract_results(json_data: any) {

    return [{
      name: 'Good',
      value: json_data.verified_urls_cnt
    }, {
      name: 'Bad',
      value: json_data.fake_urls_cnt
    }, {
      name: 'Unknown',
      value: json_data.unknown_urls_cnt
    }]
  }

  onSubmit() {
    this.show_you = true
    this.loading_you = true
    console.log("clicked!!!")
    this.apiService.getEvaluation(`count_urls/users?handle=${this.screen_name}`).subscribe((results: any) => {
      this.loading_you = false
      this.result_you = results

      this.pie_data_you = this.extract_results(results)

      this.update_overall()
    })
  }
}
