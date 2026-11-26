import type {LevelSpec} from './core.js';
export const SS24_LEVELS:readonly LevelSpec[]=[
  {
    "id": "ss24-01",
    "title": "L’atelier des départs",
    "mode": "quartet",
    "rows": [
      "####################",
      "#........#.........#",
      "#........#......m.m#",
      "#.MooT...#.........#",
      "#..................#",
      "#.o.o.o#.#.........#",
      "#...#....#.........#",
      "#.Z...B.o#.........#",
      "#........#.........#",
      "#..o.....#########.#",
      "#.o......#...o.....#",
      "#~~~~s~~.#.g.....g.#",
      "#~~~s~~~.#...1.....#",
      "#~~~~~~~...........#",
      "#........#.........#",
      "#........#...m.m...#",
      "#........#.........#",
      "#........#.g.....g.#",
      "#........#.........#",
      "####################"
    ],
    "circuits": [
      {
        "id": "relai",
        "color": 14,
        "buttons": [
          {
            "x": 5,
            "y": 3
          }
        ]
      },
      {
        "id": "presse",
        "color": 10,
        "buttons": [
          {
            "x": 3,
            "y": 16
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 9,
          "y": 13
        },
        "circuit": "relai",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 18,
          "y": 9
        },
        "circuit": "relai",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 15,
          "y": 15
        },
        "circuit": "presse",
        "direction": "W",
        "closedWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss24-02",
    "title": "L’escalier à rebours",
    "mode": "quartet",
    "rows": [
      "################",
      "########....#..#",
      "########.M..o..#",
      "########....T..#",
      "########BZ.....#",
      "########.......#",
      "############.###",
      "########.......#",
      "#.g.g..#.......#",
      "#......#.......#",
      "#.g.g.o........#",
      "#......#.......#",
      "########.......#",
      "################"
    ],
    "circuits": [
      {
        "id": "passage",
        "color": 14,
        "buttons": [
          {
            "x": 12,
            "y": 9
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 7,
          "y": 10
        },
        "circuit": "passage",
        "direction": "W",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss24-03",
    "title": "Les tiroirs décalés",
    "mode": "quartet",
    "rows": [
      "################",
      "################",
      "#.....####..g.g#",
      "#.....####.....#",
      "#....MooT.#....#",
      "#.....##.......#",
      "#.....##.......#",
      "#...BZoo~......#",
      "#.......##.....#",
      "#......###..g.g#",
      "################",
      "################"
    ]
  },
  {
    "id": "ss24-04",
    "title": "Le pas et la visée",
    "mode": "quartet",
    "rows": [
      "#################",
      "#################",
      "#...#############",
      "#..o~~3##########",
      "#...##......#####",
      "#...#ZT...M.#g.g#",
      "#...###.#...#...#",
      "#......o.B......#",
      "#######.#...#...#",
      "#######.....#g.g#",
      "#######.....#####",
      "#################",
      "#################"
    ],
    "circuits": [
      {
        "id": "acces",
        "buttons": [
          {
            "x": 7,
            "y": 9
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 4,
          "y": 7
        },
        "circuit": "acces",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 12,
          "y": 7
        },
        "circuit": "acces",
        "direction": "E",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss24-05",
    "title": "Le relais interrompu",
    "mode": "quartet",
    "rows": [
      "##################",
      "##################",
      "##############g.g#",
      "############o#...#",
      "##...........~...#",
      "##...........#...#",
      "##...........#g.g#",
      "##...........#####",
      "###.........######",
      "###.....#..#######",
      "###..Mo.TZ.o######",
      "###.....#..#######",
      "###.......B.######",
      "###.........######",
      "##################",
      "##################"
    ],
    "circuits": [
      {
        "id": "relais",
        "buttons": [
          {
            "x": 8,
            "y": 10
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 12,
          "y": 4
        },
        "circuit": "relais",
        "direction": "E",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss24-06",
    "title": "Trois postes, un seul retour",
    "mode": "quartet",
    "rows": [
      "####################",
      "####################",
      "##ggg###############",
      "##...#..############",
      "####.#..############",
      "##......########g###",
      "##......########.m.#",
      "##....T.....####.###",
      "##M.o.2......~~B.###",
      "##.........#########",
      "##..........########",
      "##....Z...#.########",
      "##........~.########",
      "##........##########",
      "##........##########",
      "##........##########",
      "####################",
      "####################"
    ],
    "facing": "N",
    "circuits": [
      {
        "id": "chargement",
        "color": 10,
        "buttons": [
          {
            "x": 10,
            "y": 10
          }
        ]
      },
      {
        "id": "depot",
        "color": 11,
        "buttons": [
          {
            "x": 11,
            "y": 12
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 6,
          "y": 6
        },
        "circuit": "chargement",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 8
        },
        "circuit": "chargement",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 4,
          "y": 4
        },
        "circuit": "depot",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 6
        },
        "circuit": "depot",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss24-07",
    "title": "La place qui restera sûre",
    "mode": "quartet",
    "rows": [
      "####################",
      "####################",
      "#################gg#",
      "#################gg#",
      "####.........Z###..#",
      "####.##.##.##.###..#",
      "###.1T.........~.o.#",
      "###.#..#..#....~~..#",
      "##............B~s..#",
      "##.............~~..#",
      "##Mo.........#.~~..#",
      "##..........#..##..#",
      "##.............##..#",
      "##.............##..#",
      "##.............##..#",
      "####################"
    ],
    "facing": "E",
    "circuits": [
      {
        "id": "premier",
        "color": 8,
        "buttons": [
          {
            "x": 4,
            "y": 10
          }
        ]
      },
      {
        "id": "deuxieme",
        "color": 9,
        "buttons": [
          {
            "x": 7,
            "y": 10
          }
        ]
      },
      {
        "id": "troisieme",
        "color": 6,
        "buttons": [
          {
            "x": 10,
            "y": 10
          }
        ]
      },
      {
        "id": "livraison",
        "color": 11,
        "buttons": [
          {
            "x": 12,
            "y": 10
          }
        ]
      },
      {
        "id": "passage",
        "color": 10,
        "buttons": [
          {
            "x": 17,
            "y": 7
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 4,
          "y": 6
        },
        "circuit": "premier",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 7,
          "y": 6
        },
        "circuit": "deuxieme",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 6
        },
        "circuit": "troisieme",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 16,
          "y": 6
        },
        "circuit": "livraison",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 14,
          "y": 10
        },
        "circuit": "livraison",
        "direction": "E",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 15,
          "y": 10
        },
        "circuit": "passage",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss24-08",
    "title": "Le dernier pas sans échange",
    "mode": "quartet",
    "rows": [
      "####################",
      "##############.gggg#",
      "##############.....#",
      "############oo.....#",
      "##.........#.......#",
      "##....Mo...#..##.###",
      "##.........#~..#.###",
      "##..............4###",
      "##......T....Z.#.###",
      "##........o..B....##",
      "##.........#..######",
      "##.........#..######",
      "####################",
      "####################",
      "####################",
      "####################"
    ],
    "facing": "E",
    "circuits": [
      {
        "id": "atelier",
        "color": 10,
        "buttons": [
          {
            "x": 10,
            "y": 5
          }
        ]
      },
      {
        "id": "composition",
        "color": 11,
        "buttons": [
          {
            "x": 12,
            "y": 5
          },
          {
            "x": 10,
            "y": 7
          },
          {
            "x": 12,
            "y": 7
          }
        ]
      },
      {
        "id": "coude",
        "color": 6,
        "buttons": [
          {
            "x": 13,
            "y": 7
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 11,
          "y": 7
        },
        "circuit": "atelier",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 11,
          "y": 8
        },
        "circuit": "atelier",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 11,
          "y": 9
        },
        "circuit": "atelier",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 14,
          "y": 3
        },
        "circuit": "composition",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 5
        },
        "circuit": "composition",
        "direction": "N",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 12,
          "y": 6
        },
        "circuit": "coude",
        "activeWhen": "released"
      }
    ]
  }
];
