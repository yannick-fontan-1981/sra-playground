import type {LevelSpec} from './core.js';
export const SS19_LEVELS:readonly LevelSpec[]=[
  {
    "id": "ss19-l1",
    "title": "Les galeries de la première chasse",
    "rows": [
      "####################",
      "####.#########o#####",
      "##..o.............##",
      "##..o.............##",
      "#g..W.Z...........g#",
      "##................##",
      "##................##",
      "##..################",
      "##............######",
      "##..o#o.o.....#..m##",
      "##....#.......#~####",
      "##....B........#####",
      "##...o~~s......#####",
      "############..######",
      "##................##",
      "##..............o.##",
      "#g................##",
      "##................##",
      "####################",
      "####################"
    ],
    "facing": "N",
    "mirrors": [
      {
        "at": {
          "x": 13,
          "y": 3
        },
        "facing": "NW"
      }
    ],
    "circuits": [
      {
        "id": "charge",
        "color": 10,
        "buttons": [
          {
            "x": 4,
            "y": 1
          },
          {
            "x": 16,
            "y": 16
          }
        ]
      },
      {
        "id": "optique",
        "color": 15,
        "buttons": [
          {
            "x": 14,
            "y": 1
          }
        ]
      },
      {
        "id": "chœur",
        "color": 6,
        "buttons": [
          {
            "x": 9,
            "y": 9
          },
          {
            "x": 11,
            "y": 9
          }
        ]
      },
      {
        "id": "capture",
        "color": 14,
        "buttons": [
          {
            "x": 13,
            "y": 12
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 2,
          "y": 4
        },
        "circuit": "charge",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 17,
          "y": 4
        },
        "circuit": "optique",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 2,
          "y": 16
        },
        "circuit": "chœur",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 15,
          "y": 9
        },
        "circuit": "capture",
        "direction": "S",
        "closedWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss19-02",
    "title": "Le gardien du seuil",
    "rows": [
      "####################",
      "####################",
      "####################",
      "#####..........m####",
      "####################",
      "####################",
      "######W.......######",
      "########.#####.o####",
      "########.......#.###",
      "##..####.....B...###",
      "##.Z~~~~.........g##",
      "##..####.........###",
      "########.........###",
      "########.........###",
      "########.........###",
      "#########g#####g####",
      "####################",
      "####################",
      "####################",
      "####################"
    ],
    "facing": "E",
    "circuits": [
      {
        "id": "seuil",
        "buttons": [
          {
            "x": 11,
            "y": 3
          },
          {
            "x": 3,
            "y": 10
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 9,
          "y": 15
        },
        "circuit": "seuil",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 15,
          "y": 15
        },
        "circuit": "seuil",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 17,
          "y": 10
        },
        "circuit": "seuil",
        "direction": "W",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss19-03",
    "title": "L’interrupteur hors d’atteinte",
    "rows": [
      "####################",
      "####################",
      "##o#####.....#..#..#",
      "##~#####.....#.#o#.#",
      "##~#####.........#.#",
      "##~#####..#..#...#.#",
      "##.~~~.#.....#..#..#",
      "########.....#...g##",
      "########B....#...#.#",
      "########.....#######",
      "########.....#######",
      "########.....#.....#",
      "########.....#....Z#",
      "########.....#.....#",
      "########W..........#",
      "########.....#.....#",
      "########.....#o.g..#",
      "#########g#..#.....#",
      "####################",
      "####################"
    ],
    "mirrors": [
      {
        "at": {
          "x": 2,
          "y": 6
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "alternance",
        "buttons": [
          {
            "x": 6,
            "y": 6
          }
        ],
        "color": 15
      },
      {
        "id": "charges",
        "buttons": [
          {
            "x": 10,
            "y": 4
          },
          {
            "x": 8,
            "y": 11
          }
        ],
        "color": 12
      }
    ],
    "gates": [
      {
        "at": {
          "x": 13,
          "y": 4
        },
        "circuit": "alternance",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 13,
          "y": 14
        },
        "circuit": "alternance",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 17
        },
        "circuit": "alternance",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 9,
          "y": 16
        },
        "circuit": "charges",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 17,
          "y": 7
        },
        "circuit": "charges",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss19-04",
    "title": "Le gardien de la vanne",
    "rows": [
      "####################",
      "####################",
      "##....#....~~~.....#",
      "##Woo......~~~.....#",
      "##....#....~~~.....#",
      "#######....~m#...Z.#",
      "#######.B..~~#.....#",
      "#######....~~~.....#",
      "#######....~~~.....#",
      "#######....~~~.....#",
      "#######....~~~.....#",
      "#######....~~~.....#",
      "#######....~~~.....#",
      "#######....s~~....g#",
      "#####......~~~.....#",
      "#####g.....~~~..g..#",
      "#######....~~~.....#",
      "####################",
      "####################",
      "####################"
    ],
    "circuits": [
      {
        "id": "gardien",
        "buttons": [
          {
            "x": 12,
            "y": 5
          }
        ],
        "color": 12
      },
      {
        "id": "trappe",
        "buttons": [
          {
            "x": 17,
            "y": 5
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 6,
          "y": 3
        },
        "circuit": "gardien",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 15
        },
        "circuit": "gardien",
        "direction": "N",
        "closedWhen": "pressed"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 12,
          "y": 6
        },
        "circuit": "trappe",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss19-05",
    "title": "Le troisième doit rester vivant",
    "rows": [
      "####################",
      "####################",
      "#########.W.########",
      "#########.og########",
      "#########...########",
      "########m#.#m###.###",
      "###.####.....###Z###",
      "###.#####.######.###",
      "###.#.#.#.##.......#",
      "###.#.#............#",
      "###.#m#............#",
      "###B#.#............#",
      "###.#o#............#",
      "###.###............#",
      "###................#",
      "###..............g.#",
      "###g###............#",
      "####################",
      "####################",
      "####################"
    ],
    "circuits": [
      {
        "id": "captif",
        "buttons": [
          {
            "x": 5,
            "y": 8
          }
        ],
        "color": 12
      },
      {
        "id": "presse-ouest",
        "buttons": [
          {
            "x": 16,
            "y": 8
          }
        ],
        "color": 15
      },
      {
        "id": "presse-sud",
        "buttons": [
          {
            "x": 16,
            "y": 12
          }
        ],
        "color": 6
      },
      {
        "id": "meule",
        "buttons": [
          {
            "x": 9,
            "y": 12
          }
        ],
        "color": 10
      }
    ],
    "gates": [
      {
        "at": {
          "x": 17,
          "y": 15
        },
        "circuit": "captif",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 4
        },
        "circuit": "captif",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 8,
          "y": 6
        },
        "circuit": "captif",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 11,
          "y": 6
        },
        "circuit": "captif",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 4
        },
        "circuit": "captif",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 11,
          "y": 4
        },
        "circuit": "captif",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 6
        },
        "circuit": "presse-ouest",
        "direction": "W",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 9,
          "y": 6
        },
        "circuit": "presse-sud",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 11,
          "y": 3
        },
        "circuit": "meule",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss19-06",
    "title": "La seconde image",
    "rows": [
      "####################",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~...g~~~~~~~~#",
      "#~~~~~~....~~~~~~~~#",
      "#~~~~~~....~~~~~~~~#",
      "#~~~~~~~~~~B~~~~~~~#",
      "#~~~.~~~~~~.~o~~~~~#",
      "#~~~.~~~~~~.~.~~~~~#",
      "#~~~.~~~.~..~.~~~~~#",
      "#~~~.~~~~~.~~.~~~~~#",
      "#~.....~~~..~~~~~~~#",
      "#~.....~~~..~~~~~~~#",
      "#~.W...~~~..~o~~~~~#",
      "#~.....~~~..~~~~~~~#",
      "#~.........~..~~~~~#",
      "#~.Z.......#.~~~~~~#",
      "#~.....~~~~~.....~~#",
      "#~~~~~~~~~~~..g.g~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "####################"
    ],
    "facing": "N",
    "mirrors": [
      {
        "at": {
          "x": 8,
          "y": 8
        },
        "facing": "NW"
      },
      {
        "at": {
          "x": 13,
          "y": 14
        },
        "facing": "NW"
      }
    ],
    "circuits": [
      {
        "id": "retard",
        "buttons": [
          {
            "x": 8,
            "y": 14
          }
        ],
        "color": 15
      }
    ],
    "gates": [
      {
        "at": {
          "x": 8,
          "y": 4
        },
        "circuit": "retard",
        "direction": "S",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 2
        },
        "circuit": "retard",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 12,
          "y": 16
        },
        "circuit": "retard",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss19-07",
    "title": "Le relais condamné",
    "rows": [
      "####################",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~~~~~~~~~#",
      "#~~~~~~~~~~#~~~~~~~#",
      "#g.~~.~~g~~..~~~~~~#",
      "#~.~~.~~~~~~~~~~~~~#",
      "#~g~~.~~~~~~~~~~~~~#",
      "#~~......~~......~~#",
      "#~~.W..B.~~...om.~~#",
      "#~~......~~......~~#",
      "#~.......#~......~~#",
      "#~~......o~......~~#",
      "#~~.......~......~~#",
      "#~...Z....~~~~~~~~~#",
      "#~~~~~~~~.~~~~~~~~~#",
      "####################"
    ],
    "facing": "N",
    "mirrors": [
      {
        "at": {
          "x": 11,
          "y": 8
        },
        "facing": "SW"
      },
      {
        "at": {
          "x": 12,
          "y": 8
        },
        "facing": "SW"
      },
      {
        "at": {
          "x": 3,
          "y": 14
        },
        "facing": "NE"
      }
    ],
    "circuits": [
      {
        "id": "relais",
        "buttons": [
          {
            "x": 9,
            "y": 18
          }
        ],
        "color": 15
      },
      {
        "id": "quai",
        "buttons": [
          {
            "x": 16,
            "y": 12
          }
        ],
        "color": 10
      }
    ],
    "gates": [
      {
        "at": {
          "x": 11,
          "y": 8
        },
        "circuit": "relais",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 1,
          "y": 8
        },
        "circuit": "quai",
        "direction": "S",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss19-08",
    "title": "Les deux gardiens vivants",
    "rows": [
      "####################",
      "#....###############",
      "#....###############",
      "#.W..#....m#########",
      "#....#.#############",
      "#...Z#.##########o##",
      "##.###.##########~##",
      "##.#########...m#~##",
      "##.#########.####~##",
      "#............####~##",
      "#.......B....####~##",
      "#............~~~~.##",
      "#...........########",
      "#...........########",
      "#...........########",
      "#.......g...########",
      "#............#...###",
      "#............~g..###",
      "#.........g..#...###",
      "####################"
    ],
    "facing": "N",
    "mirrors": [
      {
        "at": {
          "x": 17,
          "y": 11
        },
        "facing": "NW"
      }
    ],
    "circuits": [
      {
        "id": "reserve",
        "buttons": [
          {
            "x": 17,
            "y": 5
          }
        ],
        "color": 10
      },
      {
        "id": "lacher",
        "buttons": [
          {
            "x": 3,
            "y": 16
          }
        ],
        "color": 7
      },
      {
        "id": "gardien-ouest",
        "buttons": [
          {
            "x": 6,
            "y": 6
          }
        ],
        "color": 15
      },
      {
        "id": "gardien-est",
        "buttons": [
          {
            "x": 12,
            "y": 11
          }
        ],
        "color": 12
      }
    ],
    "gates": [
      {
        "at": {
          "x": 11,
          "y": 11
        },
        "circuit": "reserve",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 6,
          "y": 4
        },
        "circuit": "lacher",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 12,
          "y": 8
        },
        "circuit": "lacher",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 8,
          "y": 15
        },
        "circuit": "gardien-ouest",
        "direction": "W",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 18
        },
        "circuit": "gardien-est",
        "direction": "W",
        "closedWhen": "released"
      }
    ]
  }
];
