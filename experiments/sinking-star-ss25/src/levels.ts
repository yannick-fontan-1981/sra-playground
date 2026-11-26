import type {LevelSpec} from './core.js';
export const SS25_LEVELS:readonly LevelSpec[]=[
  {
    "id": "ss25-01",
    "title": "Le chantier des quatre gestes",
    "mode": "quartet",
    "rows": [
      "####################",
      "#..................#",
      "#..W....o~~~.......#",
      "#..oo.Z..~~~.......#",
      "#..o.....~~~.......#",
      "#..To#...~s~.......#",
      "#........s~~.......#",
      "#...o.B..~~~.......#",
      "#...#....~~~....m..#",
      "#.....o............#",
      "#...............m..#",
      "#..................#",
      "#..................#",
      "#..................#",
      "#.........o........#",
      "#..m..........######",
      "#.........1...#g.g.#",
      "#..m...............#",
      "#.............#g.g.#",
      "####################"
    ],
    "circuits": [
      {
        "id": "releve",
        "color": 14,
        "buttons": [
          {
            "x": 3,
            "y": 5
          },
          {
            "x": 10,
            "y": 17
          }
        ]
      },
      {
        "id": "presse",
        "color": 10,
        "buttons": [
          {
            "x": 7,
            "y": 14
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 14,
          "y": 17
        },
        "circuit": "releve",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 3,
          "y": 17
        },
        "circuit": "presse",
        "direction": "N",
        "closedWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss25-02",
    "title": "Le quai à deux réceptions",
    "mode": "quartet",
    "rows": [
      "####################",
      "####################",
      "####################",
      "####...####...#...##",
      "####.T........#...##",
      "####...####....Z..##",
      "#.......####.##...##",
      "#...W1o........#####",
      "#.......###.~..#g.g#",
      "#.......###........#",
      "#...B..........#...#",
      "#.......###....#g.g#",
      "####################",
      "####################"
    ],
    "circuits": [
      {
        "id": "envoi",
        "color": 10,
        "buttons": [
          {
            "x": 5,
            "y": 10
          }
        ]
      },
      {
        "id": "reception",
        "color": 11,
        "buttons": [
          {
            "x": 12,
            "y": 5
          }
        ]
      },
      {
        "id": "depot",
        "color": 14,
        "buttons": [
          {
            "x": 15,
            "y": 5
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 12,
          "y": 7
        },
        "circuit": "envoi",
        "direction": "N",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 10,
          "y": 4
        },
        "circuit": "envoi",
        "direction": "E",
        "closedWhen": "pressed"
      },
      {
        "at": {
          "x": 14,
          "y": 5
        },
        "circuit": "reception",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 15,
          "y": 9
        },
        "circuit": "reception",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 9
        },
        "circuit": "depot",
        "direction": "E",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss25-03",
    "title": "Les deux formes du pont",
    "mode": "quartet",
    "rows": [
      "###################",
      "###################",
      "#......############",
      "#......#.T..#######",
      "#......~....##....#",
      "#...Woos....##.g.g#",
      "#......~~~####....#",
      "#......~~.........#",
      "#......~~~####....#",
      "#......s.Z..##.g.g#",
      "#......~....##....#",
      "#..B...#....#######",
      "###################",
      "###################"
    ],
    "circuits": [
      {
        "id": "haut",
        "color": 10,
        "buttons": [
          {
            "x": 10,
            "y": 4
          }
        ]
      },
      {
        "id": "bas",
        "color": 11,
        "buttons": [
          {
            "x": 10,
            "y": 10
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
        "circuit": "haut",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 13,
          "y": 7
        },
        "circuit": "bas",
        "direction": "E",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss25-04",
    "title": "La cale que l’on reprend",
    "mode": "quartet",
    "rows": [
      "####################",
      "####################",
      "####################",
      "#........####......#",
      "#........####......#",
      "#....WooT..........#",
      "#........#~##...B..#",
      "#.........o~~Z.....#",
      "#.........~##......#",
      "#.........1......###",
      "#.........###.##.###",
      "#.............##.###",
      "#.........####g...g#",
      "#.........####.....#",
      "#.........####.....#",
      "##############g...g#",
      "####################"
    ],
    "circuits": [
      {
        "id": "traction",
        "color": 11,
        "buttons": [
          {
            "x": 9,
            "y": 5
          }
        ]
      },
      {
        "id": "releve",
        "color": 10,
        "buttons": [
          {
            "x": 13,
            "y": 7
          }
        ]
      },
      {
        "id": "dernier",
        "color": 14,
        "buttons": [
          {
            "x": 14,
            "y": 3
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 10,
          "y": 11
        },
        "circuit": "releve",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 9
        },
        "circuit": "traction",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 10
        },
        "circuit": "releve",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 11
        },
        "circuit": "dernier",
        "direction": "S",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 11,
          "y": 7
        },
        "circuit": "releve",
        "activeWhen": "pressed"
      },
      {
        "at": {
          "x": 12,
          "y": 7
        },
        "circuit": "releve",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss25-05",
    "title": "La cale qui change de côté",
    "mode": "quartet",
    "rows": [
      "####################",
      "####################",
      "################.gg#",
      "################.gg#",
      "#########...Z..#...#",
      "#########......#...#",
      "#########......~...#",
      "#########.T....#...#",
      "##.......#.##..#####",
      "##.......#.##..#####",
      "##.............#####",
      "##.Woo2........#####",
      "##.........B...#####",
      "##.............#####",
      "##.............#####",
      "####################",
      "####################",
      "####################"
    ],
    "facing": "E",
    "circuits": [
      {
        "id": "reserve",
        "color": 10,
        "buttons": [
          {
            "x": 8,
            "y": 11
          }
        ]
      },
      {
        "id": "service",
        "color": 11,
        "buttons": [
          {
            "x": 13,
            "y": 11
          }
        ]
      },
      {
        "id": "depart",
        "color": 9,
        "buttons": [
          {
            "x": 13,
            "y": 6
          },
          {
            "x": 11,
            "y": 7
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 8,
          "y": 9
        },
        "circuit": "reserve",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 8
        },
        "circuit": "service",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 16,
          "y": 6
        },
        "circuit": "depart",
        "direction": "E",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss25-06",
    "title": "Le dernier usage de la butée",
    "mode": "quartet",
    "rows": [
      "####################",
      "####################",
      "#######ggg##########",
      "#######...##########",
      "#########.##########",
      "#####......#########",
      "#####......###g#####",
      "#####......###.#####",
      "########~#####.#####",
      "####..o....~~.B..###",
      "####.o.....~~....###",
      "######~#.####....###",
      "##.........##....###",
      "##.........#########",
      "##.........#########",
      "##Wo..Z..T.#########",
      "##.........#########",
      "##.........#########",
      "####################",
      "####################"
    ],
    "facing": "N",
    "circuits": [
      {
        "id": "service",
        "color": 10,
        "buttons": [
          {
            "x": 6,
            "y": 15
          }
        ]
      },
      {
        "id": "couronne",
        "color": 11,
        "buttons": [
          {
            "x": 8,
            "y": 6
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 8,
          "y": 11
        },
        "circuit": "service",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 9,
          "y": 4
        },
        "circuit": "couronne",
        "direction": "N",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 14,
          "y": 8
        },
        "circuit": "couronne",
        "direction": "N",
        "closedWhen": "released"
      }
    ]
  },
  {
    "id": "ss25-07",
    "title": "Le retour de la troisième charge",
    "mode": "quartet",
    "rows": [
      "####################",
      "####################",
      "################ggg#",
      "################..g#",
      "##.........#####...#",
      "##Wo..#....#####...#",
      "##.........######.##",
      "##..B......#.......#",
      "##...o.....~.T.....#",
      "##.........#....Z..#",
      "##.........#.......#",
      "##.........#.......#",
      "################.###",
      "################.###",
      "##############..o.##",
      "##############....##",
      "##############....##",
      "####################",
      "####################",
      "####################"
    ],
    "facing": "E",
    "circuits": [
      {
        "id": "traversee",
        "color": 10,
        "buttons": [
          {
            "x": 5,
            "y": 5
          }
        ]
      },
      {
        "id": "reserve",
        "color": 9,
        "buttons": [
          {
            "x": 9,
            "y": 8
          }
        ]
      },
      {
        "id": "arrivees",
        "color": 11,
        "buttons": [
          {
            "x": 4,
            "y": 4
          },
          {
            "x": 7,
            "y": 7
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 16,
          "y": 12
        },
        "circuit": "reserve",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 17,
          "y": 6
        },
        "circuit": "arrivees",
        "direction": "N",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 11,
          "y": 8
        },
        "circuit": "traversee",
        "activeWhen": "pressed"
      }
    ]
  },
  {
    "id": "ss25-08",
    "title": "Les deux accès avant le retour",
    "mode": "quartet",
    "rows": [
      "####################",
      "####################",
      "####################",
      "#####m########m#####",
      "#####.########.#####",
      "###..............###",
      "###..............###",
      "###..............###",
      "###..............###",
      "#####.####~###.#####",
      "###.....##~##.....##",
      "###..T..#Z~##.....##",
      "###..1....~##.4...##",
      "###.....#.~##.W...##",
      "###....B#o~#########",
      "##########.....#####",
      "##########.....#####",
      "##########.....#####",
      "##########gggg.#####",
      "####################"
    ],
    "facing": "N",
    "circuits": [
      {
        "id": "rive-gauche",
        "color": 10,
        "buttons": [
          {
            "x": 5,
            "y": 3
          }
        ]
      },
      {
        "id": "rive-droite",
        "color": 11,
        "buttons": [
          {
            "x": 14,
            "y": 3
          }
        ]
      }
    ],
    "gates": [
      {
        "at": {
          "x": 5,
          "y": 9
        },
        "circuit": "rive-gauche",
        "direction": "S",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 9,
          "y": 11
        },
        "circuit": "rive-gauche",
        "direction": "E",
        "closedWhen": "released"
      },
      {
        "at": {
          "x": 14,
          "y": 9
        },
        "circuit": "rive-droite",
        "direction": "S",
        "closedWhen": "released"
      }
    ],
    "platforms": [
      {
        "at": {
          "x": 10,
          "y": 9
        },
        "circuit": "rive-gauche",
        "activeWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 10
        },
        "circuit": "rive-gauche",
        "activeWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 12
        },
        "circuit": "rive-droite",
        "activeWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 13
        },
        "circuit": "rive-droite",
        "activeWhen": "released"
      },
      {
        "at": {
          "x": 10,
          "y": 14
        },
        "circuit": "rive-droite",
        "activeWhen": "released"
      }
    ]
  }
];
