"use client";

import React, { useState, useEffect } from "react";
import Styles from "./Hide_Menu.module.css";

export const Hide_Menu = () => {
  const [categories, setCategories] = useState([]);
  const [dishes, setDishes] = useState([]);

  useEffect(() => {
    // Загрузка категорий
    const fetchCategories = async () => {
      try {
        const response = await fetch("/api/contman/hideCategories");
        const data = await response.json();
        if (data.success) {
          setCategories(data.categories);
        } else {
          console.error("Ошибка загрузки категорий:", data.message);
        }
      } catch (error) {
        console.error("Ошибка при загрузке категорий:", error);
      }
    };

    // Загрузка блюд
    const fetchDishes = async () => {
      try {
        const response = await fetch("/api/contman/hideMenu");
        const data = await response.json();
        if (response.ok) {
          setDishes(data.menu);
        } else {
          console.error("Ошибка при получении блюд:", data.message);
        }
      } catch (error) {
        console.error("Ошибка при загрузке блюд:", error);
      }
    };

    fetchCategories();
    fetchDishes();
  }, []);

  const removeDish = async (dishId) => {
    const confirmDelete = window.confirm(
      "Вы уверены, что хотите удалить блюдо?"
    );
    if (!confirmDelete) {
      return; // Отмена удаления
    }

    try {
      const response = await fetch("/api/contman/removeDish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dishId }), // Отправляем dishId
      });

      const result = await response.json();

      if (result.success) {
        // Если успешное удаление, обновляем блюда локально
        setDishes((prevDishes) =>
          prevDishes.filter((dish) => dish.ID !== dishId)
        );
      } else {
        // Если ошибка, выводим сообщение из ответа сервера
        alert(result.message || "Ошибка при удалении блюда");
      }
    } catch (err) {
      console.error("Ошибка при удалении блюда:", err);
      alert("Произошла ошибка при попытке удалить блюдо. Попробуйте снова.");
    }
  };

  const recoveryDish = async (dishId) => {
    const confirmDelete = window.confirm(
      "Вы уверены, что хотите восствновить блюдо?"
    );
    if (!confirmDelete) {
      return; // Отмена восствновления
    }

    try {
      const response = await fetch("/api/contman/recoveryDish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ dishId }), // Отправляем dishId
      });

      const result = await response.json();

      if (result.success) {
        // Если успешное восстановление, обновляем блюда локально
        setDishes((prevDishes) =>
          prevDishes.filter((dish) => dish.ID !== dishId)
        );
      } else {
        // Если ошибка, выводим сообщение из ответа сервера
        alert(result.message || "Ошибка при восствновлении блюда");
      }
    } catch (err) {
      console.error("Ошибка при восствновлении блюда:", err);
      alert(
        "Произошла ошибка при попытке восстановить блюдо. Попробуйте снова."
      );
    }
  };

  const recoveryCategory = async (categoryId) => {
    const confirmDelete = window.confirm(
      "Вы уверены, что хотите восстановить категорию?"
    );
    if (!confirmDelete) {
      return; // Отмена восстановления
    }

    try {
      const response = await fetch("/api/contman/recoveryCategories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ categoryId }), // Отправляем categoryId
      });

      const result = await response.json();

      if (result.success) {
        // Если успешное восстановление, обновляем категории локально
        setCategories((prevCategories) =>
          prevCategories.filter((category) => category.ID !== categoryId)
        );
      } else {
        // Если ошибка, выводим сообщение из ответа сервера
        alert(result.message || "Ошибка при восстановлении категории");
      }
    } catch (err) {
      console.error("Ошибка при восстановлении категории:", err);
      alert(
        "Произошла ошибка при попытке восстановить категорию. Попробуйте снова."
      );
    }
  };

  const removeCategory = async (categoryId) => {
    const confirmDelete = window.confirm(
      "Вы уверены, что хотите удалить категорию? Она удалится со всеми блюдами"
    );
    if (!confirmDelete) {
      return; // Отмена удаления
    }

    try {
      const response = await fetch("/api/contman/removeCategory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ categoryId }), // Отправляем categoryId
      });

      const result = await response.json();

      if (result.success) {
        // Если успешное удаление, обновляем категории локально
        setCategories((prevCategories) =>
          prevCategories.filter((category) => category.ID !== categoryId)
        );
      } else {
        // Если ошибка, выводим сообщение из ответа сервера
        alert(result.message || "Ошибка при удалении категории");
      }
    } catch (err) {
      console.error("Ошибка при удалении категории:", err);
      alert(
        "Произошла ошибка при попытке удалить категорию. Попробуйте снова."
      );
    }
  };

  return (
    <div className={Styles.delivery_menu}>
      <h2 className={Styles.delivery_h}>Меню доставки</h2>
      <div className={Styles.foods}>
        {categories.map((category) => (
          <div key={category.ID} className={Styles.category}>
            <div className={Styles.category_name}>
              {category.Статус_удаления === 1 && (
                <>
                  <button
                    className={Styles.button_category}
                    onClick={() => removeCategory(category.ID)}
                  >
                    <p className={Styles.remove_text}>Удалить категорию</p>
                  </button>
                </>
              )}
              <h2 className={Styles.category_h}>{category.Наименование}</h2>
              {category.Статус_удаления === 1 && (
                <>
                  <button
                    className={Styles.button_category}
                    onClick={() => recoveryCategory(category.ID)}
                  >
                    <p className={Styles.remove_text}>Восстановить категорию</p>
                  </button>
                </>
              )}
            </div>
            <hr className={Styles.hr_name} />
            <div className={Styles.foods_category}>
              {dishes
                .filter((dish) => dish.Категория === category.Наименование)
                .map((dish) => (
                  <div key={dish.ID} className={Styles.food}>
                    <button
                      className={Styles.button_remove}
                      onClick={() => removeDish(dish.ID)}
                    >
                      <p className={Styles.remove_text}>Удалить блюдо</p>
                    </button>
                    <img
                      className={Styles.img_food}
                      src={dish.Фото}
                      alt={dish.Название}
                    />
                    <h3 className={Styles.food_h}>{dish.Название}</h3>
                    <p className={Styles.price_menu}>
                      {dish.Скидка ? (
                        <>
                          <span className={Styles.old_price}>
                            {dish.Цена_без_скидки}₽
                          </span>{" "}
                          <span className={Styles.new_price}>
                            {dish.Цена_со_скидкой}₽
                          </span>
                        </>
                      ) : (
                        `${dish.Цена_без_скидки}₽`
                      )}
                    </p>
                    <button
                      className={Styles.button_menu_delivery}
                      onClick={() => recoveryDish(dish.ID)}
                    >
                      Восстановить блюдо
                    </button>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
